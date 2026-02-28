import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createAppointmentSchema, updateAppointmentSchema } from "@/lib/validations";
import { computeAppointmentPrice } from "@/lib/appointment-helpers";

const appointmentInclude = {
  service: true,
  serviceOption: {
    include: { subOptions: { where: { isActive: true } } },
  },
};

function enrichAppointment(apt: any) {
  const totalPrice = computeAppointmentPrice(
    { quantity: apt.quantity, selectedSubOptions: apt.selectedSubOptions || [] },
    apt.service,
    apt.serviceOption
  );
  const resolvedSubOptions = apt.serviceOption?.subOptions?.filter(
    (s: any) => apt.selectedSubOptions?.includes(s.id)
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
      const grouped: Record<string, any[]> = {};
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
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");

    const where: any = { tenantId };
    if (status) where.status = status;

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

    // Compute total revenue from all appointments (not just current page)
    const allAppointments = await prisma.appointment.findMany({
      where: { tenantId },
      include: appointmentInclude,
    });
    const totalRevenue = allAppointments.reduce(
      (sum, apt) => sum + computeAppointmentPrice(
        { quantity: apt.quantity, selectedSubOptions: apt.selectedSubOptions || [] },
        apt.service,
        apt.serviceOption
      ),
      0
    );

    const totalAll = allAppointments.length;

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
  } catch (error) {
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

    // Verify service belongs to tenant
    const service = await prisma.service.findFirst({
      where: { id: validated.serviceId, tenantId, isActive: true },
    });
    if (!service) {
      return NextResponse.json({ success: false, error: "Service not found" }, { status: 404 });
    }

    let duration = service.duration;
    let serviceOptionId: string | null = null;
    let quantity = validated.quantity ?? 1;
    let selectedSubOptions: string[] = [];

    if (validated.serviceOptionId) {
      const option = await prisma.serviceOption.findFirst({
        where: { id: validated.serviceOptionId, serviceId: service.id, isActive: true },
        include: { subOptions: { where: { isActive: true } } },
      });
      if (!option) {
        return NextResponse.json({ success: false, error: "Service option not found" }, { status: 404 });
      }
      if (option.duration) duration = option.duration;
      serviceOptionId = option.id;

      if (quantity < option.minQuantity) quantity = option.minQuantity;
      if (quantity > option.maxQuantity) quantity = option.maxQuantity;

      if (validated.selectedSubOptionIds?.length) {
        const validSubIds = option.subOptions.map((s) => s.id);
        for (const subId of validated.selectedSubOptionIds) {
          if (!validSubIds.includes(subId)) {
            return NextResponse.json({ success: false, error: "Invalid sub-option selected" }, { status: 400 });
          }
        }
        selectedSubOptions = validated.selectedSubOptionIds;
      }
    }

    const totalDuration = duration * quantity;
    const [hours, minutes] = validated.startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + totalDuration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        serviceId: validated.serviceId,
        serviceOptionId,
        quantity,
        selectedSubOptions,
        customerName: validated.customerName,
        customerPhone: validated.customerPhone,
        customerEmail: validated.customerEmail || null,
        date: new Date(validated.date),
        startTime: validated.startTime,
        endTime,
        notes: validated.notes || null,
        status: "PENDING",
      },
      include: appointmentInclude,
    });

    return NextResponse.json({ success: true, data: enrichAppointment(appointment) });
  } catch (error: any) {
    if (error.name === "ZodError") {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues ?? []) {
        const field = issue.path?.[0];
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
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
    if (body.ids && Array.isArray(body.ids)) {
      const { ids, status } = body;
      if (!status || !["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].includes(status)) {
        return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
      }

      const result = await prisma.appointment.updateMany({
        where: { id: { in: ids }, tenantId: session.user.tenantId },
        data: { status },
      });

      return NextResponse.json({ success: true, updated: result.count });
    }

    // Single update: { id: "...", status: "...", notes: "..." }
    const { id, ...data } = body;
    const validated = updateAppointmentSchema.parse(data);

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId: session.user.tenantId },
    });

    if (!appointment) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: validated,
      include: appointmentInclude,
    });

    return NextResponse.json({ success: true, data: enrichAppointment(updated) });
  } catch (error: any) {
    console.error("Appointment update error:", error);
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}
