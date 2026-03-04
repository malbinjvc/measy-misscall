import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAppointmentSchema, updateAppointmentSchema } from "@/lib/validations";
import { computeAppointmentPrice, computeMultiItemPrice, computeMultiItemDuration } from "@/lib/appointment-helpers";
import { sanitizePagination } from "@/lib/utils";
import { z, ZodError } from "zod";

const appointmentItemInclude = {
  service: true,
  serviceOption: {
    include: { subOptions: { where: { isActive: true } } },
  },
} satisfies Prisma.AppointmentItemInclude;

const appointmentInclude = {
  service: true,
  serviceOption: {
    include: { subOptions: { where: { isActive: true } } },
  },
  items: {
    include: appointmentItemInclude,
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.AppointmentInclude;

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

function enrichAppointment(apt: AppointmentWithRelations) {
  // Use items-based pricing when items exist, fallback to legacy
  let totalPrice: number;
  if (apt.items && apt.items.length > 0) {
    totalPrice = computeMultiItemPrice(apt.items);
  } else if (apt.service) {
    totalPrice = computeAppointmentPrice(
      { quantity: apt.quantity, selectedSubOptions: apt.selectedSubOptions || [] },
      apt.service,
      apt.serviceOption
    );
  } else {
    totalPrice = 0;
  }
  const resolvedSubOptions = apt.serviceOption?.subOptions?.filter(
    (s) => apt.selectedSubOptions?.includes(s.id)
  ) ?? [];
  return { ...apt, totalPrice, resolvedSubOptions };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get("mode");
    const tenantId = session.user.tenantId;

    // Calendar mode: fetch all appointments for a given month + business hours
    if (mode === "calendar") {
      const monthParam = searchParams.get("month"); // YYYY-MM
      const now = new Date();
      const year = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
      const month = monthParam ? parseInt(monthParam.split("-")[1]) - 1 : now.getMonth();

      const startOfMonth = new Date(Date.UTC(year, month, 1));
      const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

      const [appointments, businessHours] = await Promise.all([
        prisma.appointment.findMany({
          where: { tenantId, date: { gte: startOfMonth, lte: endOfMonth } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          include: appointmentInclude,
        }),
        prisma.businessHours.findMany({ where: { tenantId } }),
      ]);

      const enriched = appointments.map(enrichAppointment);

      // Group by Toronto date (shift midnight UTC → noon to prevent day rollback)
      const grouped: Record<string, ReturnType<typeof enrichAppointment>[]> = {};
      for (const apt of enriched) {
        const d = new Date(apt.date);
        if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) d.setUTCHours(12);
        const key = d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(apt);
      }

      return NextResponse.json({
        success: true,
        data: grouped,
        businessHours,
        month: `${year}-${String(month + 1).padStart(2, "0")}`,
      });
    }

    // List mode (default): paginated with stats
    const { page, pageSize } = sanitizePagination(searchParams.get("page"), searchParams.get("pageSize"));
    const status = searchParams.get("status");

    const where: Prisma.AppointmentWhereInput = { tenantId };
    if (status) where.status = status as Prisma.EnumAppointmentStatusFilter;

    const [appointments, total, statusCounts] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: appointmentInclude,
      }),
      prisma.appointment.count({ where }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { tenantId },
        _count: true,
      }),
    ]);

    const enriched = appointments.map(enrichAppointment);

    // Compute total revenue from non-cancelled appointments
    const revenueAppointments = await prisma.appointment.findMany({
      where: { tenantId, status: { not: "CANCELLED" } },
      include: appointmentInclude,
    });
    const totalRevenue = revenueAppointments.reduce(
      (sum, apt) => {
        if (apt.items && apt.items.length > 0) {
          return sum + computeMultiItemPrice(apt.items);
        }
        if (apt.service) {
          return sum + computeAppointmentPrice(
            { quantity: apt.quantity, selectedSubOptions: apt.selectedSubOptions || [] },
            apt.service,
            apt.serviceOption
          );
        }
        return sum;
      },
      0
    );

    const totalAll = statusCounts.reduce((sum, item) => sum + item._count, 0);

    const stats = {
      totalAppointments: totalAll,
      totalRevenue,
      statusCounts: statusCounts.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count }),
        {} as Record<string, number>
      ),
    };

    return NextResponse.json({
      success: true,
      data: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      stats,
    });
  } catch (error: unknown) {
    console.error("Appointments fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = createAppointmentSchema.parse(body);

    const tenantId = session.user.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { autoConfirmAppointments: true },
    });

    // Normalize items: use items array if provided, otherwise wrap legacy fields
    const rawItems = validated.items?.length
      ? validated.items
      : validated.serviceId
        ? [{ serviceId: validated.serviceId, serviceOptionId: validated.serviceOptionId, quantity: validated.quantity, selectedSubOptionIds: validated.selectedSubOptionIds }]
        : [];

    if (rawItems.length === 0) {
      return NextResponse.json({ success: false, error: "At least one service is required" }, { status: 400 });
    }

    // Validate each item and compute aggregate duration
    let totalDuration = 0;
    const validatedItems: { serviceId: string; serviceOptionId: string | null; quantity: number; selectedSubOptions: string[]; sortOrder: number }[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const service = await prisma.service.findFirst({
        where: { id: item.serviceId, tenantId, isActive: true },
      });
      if (!service) {
        return NextResponse.json({ success: false, error: `Service not found for item ${i + 1}` }, { status: 404 });
      }

      let duration = service.duration;
      let serviceOptionId: string | null = null;
      let quantity = item.quantity ?? 1;
      let selectedSubOptions: string[] = [];

      if (item.serviceOptionId) {
        const option = await prisma.serviceOption.findFirst({
          where: { id: item.serviceOptionId, serviceId: service.id, isActive: true },
          include: { subOptions: { where: { isActive: true } } },
        });
        if (!option) {
          return NextResponse.json({ success: false, error: `Service option not found for item ${i + 1}` }, { status: 404 });
        }
        if (option.duration) duration = option.duration;
        serviceOptionId = option.id;
        if (quantity < option.minQuantity) quantity = option.minQuantity;
        if (quantity > option.maxQuantity) quantity = option.maxQuantity;

        if (item.selectedSubOptionIds?.length) {
          const validSubIds = option.subOptions.map((s) => s.id);
          for (const subId of item.selectedSubOptionIds) {
            if (!validSubIds.includes(subId)) {
              return NextResponse.json({ success: false, error: `Invalid sub-option in item ${i + 1}` }, { status: 400 });
            }
          }
          selectedSubOptions = item.selectedSubOptionIds;
        }
      }

      totalDuration += duration * quantity;
      validatedItems.push({ serviceId: item.serviceId, serviceOptionId, quantity, selectedSubOptions, sortOrder: i });
    }

    // Calculate end time from aggregate duration
    const [hours, minutes] = validated.startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + totalDuration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        // Legacy fields: set to first item for backward compat
        serviceId: validatedItems[0].serviceId,
        serviceOptionId: validatedItems[0].serviceOptionId,
        quantity: validatedItems[0].quantity,
        selectedSubOptions: validatedItems[0].selectedSubOptions,
        // Nested create items
        items: {
          create: validatedItems.map((item) => ({
            serviceId: item.serviceId,
            serviceOptionId: item.serviceOptionId,
            quantity: item.quantity,
            selectedSubOptions: item.selectedSubOptions,
            sortOrder: item.sortOrder,
          })),
        },
        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail: validated.customerEmail || null,
        date: new Date(validated.date),
        startTime: validated.startTime,
        endTime,
        notes: validated.notes || null,
        vehicleYear: validated.vehicleYear || null,
        vehicleType: validated.vehicleType || null,
        vehicleMake: validated.vehicleMake || null,
        vehicleModel: validated.vehicleModel || null,
        appointmentPreference: validated.appointmentPreference || null,
        status: tenant?.autoConfirmAppointments ? "CONFIRMED" : "PENDING",
      },
      include: appointmentInclude,
    });

    return NextResponse.json({ success: true, data: enrichAppointment(appointment) });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path?.[0];
        if (field && !fieldErrors[String(field)]) {
          fieldErrors[String(field)] = issue.message;
        }
      }
      return NextResponse.json(
        { success: false, error: "Validation failed", fieldErrors },
        { status: 400 }
      );
    }
    console.error("Appointment create error:", error);
    return NextResponse.json({ success: false, error: "Create failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Bulk update: { ids: [...], status: "..." }
    if (body.ids) {
      const bulkSchema = z.object({
        ids: z.array(z.string().min(1), { message: "ids must be an array of strings" }).min(1, "ids must not be empty"),
        status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"], { message: "Invalid status" }),
      });
      const { ids, status } = bulkSchema.parse(body);

      const result = await prisma.appointment.updateMany({
        where: { id: { in: ids }, tenantId: session.user.tenantId },
        data: { status },
      });

      return NextResponse.json({ success: true, updated: result.count });
    }

    // Single update: { id: "...", status: "...", notes: "...", date: "...", startTime: "..." }
    const { id, ...data } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Appointment ID is required" }, { status: 400 });
    }

    const validated = updateAppointmentSchema.parse(data);

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: session.user.tenantId },
      include: {
        service: true,
        serviceOption: true,
        items: {
          include: {
            service: true,
            serviceOption: {
              include: { subOptions: { where: { isActive: true } } },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // Build update payload
    const updateData: Prisma.AppointmentUpdateInput = {};
    if (validated.status) updateData.status = validated.status;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.vehicleYear !== undefined) updateData.vehicleYear = validated.vehicleYear || null;
    if (validated.vehicleType !== undefined) updateData.vehicleType = validated.vehicleType || null;
    if (validated.vehicleMake !== undefined) updateData.vehicleMake = validated.vehicleMake || null;
    if (validated.vehicleModel !== undefined) updateData.vehicleModel = validated.vehicleModel || null;
    if (validated.appointmentPreference !== undefined) updateData.appointmentPreference = validated.appointmentPreference || null;

    // Reschedule: recalculate endTime from service duration
    if (validated.date && validated.startTime) {
      // Use items-based duration when items exist, fallback to legacy
      let totalDuration: number;
      if (appointment.items && appointment.items.length > 0) {
        totalDuration = computeMultiItemDuration(appointment.items);
      } else {
        const duration = appointment.serviceOption?.duration || appointment.service?.duration || 60;
        totalDuration = duration * (appointment.quantity || 1);
      }
      const [hours, minutes] = validated.startTime.split(":").map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + totalDuration;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

      // Check for overlapping appointments before rescheduling
      const appointmentDate = new Date(validated.date + "T00:00:00.000Z");
      const endOfDay = new Date(validated.date + "T23:59:59.999Z");

      const overlapping = await prisma.appointment.findFirst({
        where: {
          tenantId: session.user.tenantId,
          id: { not: id },
          date: { gte: appointmentDate, lte: endOfDay },
          status: { not: "CANCELLED" },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: validated.startTime } },
          ],
        },
      });

      if (overlapping) {
        return NextResponse.json(
          { success: false, error: "This time slot is already booked" },
          { status: 409 }
        );
      }

      updateData.date = new Date(validated.date);
      updateData.startTime = validated.startTime;
      updateData.endTime = endTime;
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: appointmentInclude,
    });

    return NextResponse.json({ success: true, data: enrichAppointment(updated) });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path?.[0];
        if (field && !fieldErrors[String(field)]) {
          fieldErrors[String(field)] = issue.message;
        }
      }
      return NextResponse.json(
        { success: false, error: "Validation failed", fieldErrors },
        { status: 400 }
      );
    }
    console.error("Appointment update error:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
