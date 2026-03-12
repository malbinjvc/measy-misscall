import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createAppointmentSchema, updateAppointmentSchema } from "@/lib/validations";
import { computeAppointmentPrice, computeMultiItemPrice, computeMultiItemDuration, type AppointmentItemForCalc } from "@/lib/appointment-helpers";
import { sanitizePagination, formatDateUTC } from "@/lib/utils";
import { sendSmsWithConsent, buildConfirmationSmsBody, buildReminderSmsBody } from "@/lib/sms";
import { z, ZodError } from "zod";

const APP_TIMEZONE = "America/Toronto";

/**
 * Convert appointment date (UTC midnight) + startTime ("HH:mm") to absolute UTC timestamp.
 * Same logic as the reminder cron uses.
 */
function appointmentToUtcMs(date: Date, startTime: string): number {
  const d = new Date(date);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) d.setUTCHours(12);
  const torontoDate = d.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, timeZoneName: "shortOffset" });
  const parts = formatter.formatToParts(d);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  const offsetMatch = offsetPart?.value?.match(/GMT([+-]?\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;
  const utc = new Date(`${torontoDate}T${startTime}:00.000Z`);
  utc.setUTCHours(utc.getUTCHours() - offsetHours);
  return utc.getTime();
}

/** Max hours before appointment to send an immediate reminder on late confirmations */
const REMINDER_CUTOFF_HOURS = 12.5;

/**
 * Fire-and-forget: send immediate reminder + mark reminderSentAt when appointment
 * is confirmed too late for the cron's 11.5-12.5h window to catch it.
 */
function maybeSendImmediateReminder(apt: {
  id: string;
  tenantId: string;
  date: Date;
  startTime: string;
  customerPhone: string;
  reminderSentAt: Date | null;
}, tenant: { name: string; slug: string; assignedTwilioNumber: string }) {
  if (apt.reminderSentAt) return; // already sent
  const hoursUntil = (appointmentToUtcMs(apt.date, apt.startTime) - Date.now()) / (60 * 60 * 1000);
  if (hoursUntil > REMINDER_CUTOFF_HOURS || hoursUntil < 1) return; // cron will handle it, or too late

  const dateStr = formatDateUTC(apt.date);
  const body = buildReminderSmsBody(tenant.name, tenant.slug, dateStr, apt.startTime);
  sendSmsWithConsent({
    tenantId: apt.tenantId,
    to: apt.customerPhone,
    from: tenant.assignedTwilioNumber,
    body,
    type: "APPOINTMENT_REMINDER",
  })
    .then(() =>
      prisma.appointment.update({ where: { id: apt.id }, data: { reminderSentAt: new Date() } })
    )
    .catch((err) => console.error("Immediate reminder SMS error:", err));
}

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
    const validItems = apt.items.filter((i) => i.service != null) as AppointmentItemForCalc[];
    totalPrice = computeMultiItemPrice(validItems);
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

      const [appointments, businessHours, tenantSettings] = await Promise.all([
        prisma.appointment.findMany({
          where: { tenantId, date: { gte: startOfMonth, lte: endOfMonth } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          include: appointmentInclude,
          take: 500, // Bounded: prevent excessive data for busy months
        }),
        prisma.businessHours.findMany({ where: { tenantId } }),
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { maxConcurrentBookings: true },
        }),
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
        maxConcurrentBookings: tenantSettings?.maxConcurrentBookings ?? 1,
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

    // Revenue: computed at DB level via raw SQL — no rows loaded into memory
    const revenueRows = await prisma.$queryRaw<[{ single_rev: number; multi_rev: number; sub_rev: number; multi_sub_rev: number }]>`
      WITH single_item_rev AS (
        SELECT COALESCE(SUM(
          (COALESCE(s.price, 0) + COALESCE(so.price, 0)) * a.quantity
        ), 0)::float AS total
        FROM "Appointment" a
        LEFT JOIN "Service" s ON s.id = a."serviceId"
        LEFT JOIN "ServiceOption" so ON so.id = a."serviceOptionId"
        WHERE a."tenantId" = ${tenantId}
          AND a.status != 'CANCELLED'
          AND NOT EXISTS (SELECT 1 FROM "AppointmentItem" ai WHERE ai."appointmentId" = a.id)
      ),
      single_sub_rev AS (
        SELECT COALESCE(SUM(sso.price), 0)::float AS total
        FROM "Appointment" a
        JOIN "ServiceOption" so ON so.id = a."serviceOptionId"
        JOIN "ServiceSubOption" sso ON sso."serviceOptionId" = so.id
          AND sso.id = ANY(a."selectedSubOptions")
        WHERE a."tenantId" = ${tenantId}
          AND a.status != 'CANCELLED'
          AND NOT EXISTS (SELECT 1 FROM "AppointmentItem" ai WHERE ai."appointmentId" = a.id)
      ),
      multi_item_rev AS (
        SELECT COALESCE(SUM(
          (COALESCE(s.price, 0) + COALESCE(so.price, 0)) * ai.quantity
        ), 0)::float AS total
        FROM "Appointment" a
        JOIN "AppointmentItem" ai ON ai."appointmentId" = a.id
        LEFT JOIN "Service" s ON s.id = ai."serviceId"
        LEFT JOIN "ServiceOption" so ON so.id = ai."serviceOptionId"
        WHERE a."tenantId" = ${tenantId}
          AND a.status != 'CANCELLED'
      ),
      multi_sub_rev AS (
        SELECT COALESCE(SUM(sso.price), 0)::float AS total
        FROM "Appointment" a
        JOIN "AppointmentItem" ai ON ai."appointmentId" = a.id
        JOIN "ServiceOption" so ON so.id = ai."serviceOptionId"
        JOIN "ServiceSubOption" sso ON sso."serviceOptionId" = so.id
          AND sso.id = ANY(ai."selectedSubOptions")
        WHERE a."tenantId" = ${tenantId}
          AND a.status != 'CANCELLED'
      )
      SELECT
        (SELECT total FROM single_item_rev) AS single_rev,
        (SELECT total FROM multi_item_rev) AS multi_rev,
        (SELECT total FROM single_sub_rev) AS sub_rev,
        (SELECT total FROM multi_sub_rev) AS multi_sub_rev
    `;
    const revRow = revenueRows[0];
    const totalRevenue = (revRow?.single_rev || 0) + (revRow?.multi_rev || 0) + (revRow?.sub_rev || 0) + (revRow?.multi_sub_rev || 0);

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
      select: { autoConfirmAppointments: true, maxConcurrentBookings: true },
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

    // Batch fetch all services and options in 2 queries (no N+1)
    const serviceIds = Array.from(new Set(rawItems.map((item) => item.serviceId)));
    const optionIds = Array.from(new Set(rawItems.map((item) => item.serviceOptionId).filter(Boolean))) as string[];

    const [servicesList, optionsList] = await Promise.all([
      prisma.service.findMany({
        where: { id: { in: serviceIds }, tenantId, isActive: true },
      }),
      optionIds.length > 0
        ? prisma.serviceOption.findMany({
            where: { id: { in: optionIds }, isActive: true },
            include: { subOptions: { where: { isActive: true } } },
          })
        : Promise.resolve([]),
    ]);

    const serviceMap = new Map(servicesList.map((s) => [s.id, s]));
    const optionMap = new Map(optionsList.map((o) => [o.id, o]));

    // Validate each item and compute aggregate duration
    let totalDuration = 0;
    const validatedItems: { serviceId: string; serviceOptionId: string | null; quantity: number; selectedSubOptions: string[]; sortOrder: number }[] = [];

    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const service = serviceMap.get(item.serviceId);
      if (!service) {
        return NextResponse.json({ success: false, error: `Service not found for item ${i + 1}` }, { status: 404 });
      }

      let duration = service.duration;
      let serviceOptionId: string | null = null;
      let quantity = item.quantity ?? 1;
      let selectedSubOptions: string[] = [];

      if (item.serviceOptionId) {
        const option = optionMap.get(item.serviceOptionId);
        if (!option || option.serviceId !== service.id) {
          return NextResponse.json({ success: false, error: `Service option not found for item ${i + 1}` }, { status: 404 });
        }
        if (option.duration) duration = option.duration;
        serviceOptionId = option.id;
        if (quantity < option.minQuantity) quantity = option.minQuantity;
        if (quantity > option.maxQuantity) quantity = option.maxQuantity;

        if (item.selectedSubOptionIds?.length) {
          const validSubIds = new Set(option.subOptions.map((s) => s.id));
          for (const subId of item.selectedSubOptionIds) {
            if (!validSubIds.has(subId)) {
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

    // Overlap check + create in a transaction to prevent race conditions
    // (two concurrent requests could both pass the count check without this)
    const appointmentDate = new Date(validated.date + "T00:00:00.000Z");
    const endOfDay = new Date(validated.date + "T23:59:59.999Z");
    const maxConcurrent = tenant?.maxConcurrentBookings ?? 1;

    const appointment = await prisma.$transaction(async (tx) => {
      // Advisory lock on tenant+date prevents phantom reads from concurrent bookings.
      // Lock is automatically released when the transaction ends.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + validated.date}))`;

      const overlappingCount = await tx.appointment.count({
        where: {
          tenantId,
          date: { gte: appointmentDate, lte: endOfDay },
          status: { not: "CANCELLED" },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: validated.startTime } },
          ],
        },
      });
      if (overlappingCount >= maxConcurrent) {
        return null;
      }

      return tx.appointment.create({
        data: {
          tenantId,
          serviceId: validatedItems[0].serviceId,
          serviceOptionId: validatedItems[0].serviceOptionId,
          quantity: validatedItems[0].quantity,
          selectedSubOptions: validatedItems[0].selectedSubOptions,
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
          smsConsent: validated.smsConsent ?? false,
          status: tenant?.autoConfirmAppointments ? "CONFIRMED" : "PENDING",
        },
        include: appointmentInclude,
      });
    });

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: "This time slot is fully booked" },
        { status: 409 }
      );
    }

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

    const tenantId = session.user.tenantId;
    const body = await req.json();

    // Bulk update: { ids: [...], status: "..." }
    if (body.ids) {
      const bulkSchema = z.object({
        ids: z.array(z.string().min(1), { message: "ids must be an array of strings" }).min(1, "ids must not be empty"),
        status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"], { message: "Invalid status" }),
      });
      const { ids, status } = bulkSchema.parse(body);

      // Fetch current statuses before update (for PENDING→CONFIRMED detection)
      const beforeAppointments = status === "CONFIRMED"
        ? await prisma.appointment.findMany({
            where: { id: { in: ids }, tenantId, status: "PENDING" },
            select: { id: true, customerPhone: true, date: true, startTime: true, smsConsent: true, reminderSentAt: true },
          })
        : [];

      const result = await prisma.appointment.updateMany({
        where: { id: { in: ids }, tenantId },
        data: { status },
      });

      // Fire-and-forget: send confirmation SMS for PENDING→CONFIRMED transitions
      if (beforeAppointments.length > 0) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true, slug: true, assignedTwilioNumber: true },
        });
        if (tenant?.assignedTwilioNumber) {
          for (const apt of beforeAppointments) {
            const dateStr = formatDateUTC(apt.date);
            const body = buildConfirmationSmsBody(tenant.name, tenant.slug, dateStr, apt.startTime);
            sendSmsWithConsent({
              tenantId,
              to: apt.customerPhone,
              from: tenant.assignedTwilioNumber,
              body,
              type: "APPOINTMENT_CONFIRMATION",
            }).catch((err) => console.error("Bulk confirmation SMS error:", err));

            // Send immediate reminder if appointment is within 12.5h (cron window already passed)
            maybeSendImmediateReminder(
              { id: apt.id, tenantId, date: apt.date, startTime: apt.startTime, customerPhone: apt.customerPhone, reminderSentAt: apt.reminderSentAt },
              { name: tenant.name, slug: tenant.slug, assignedTwilioNumber: tenant.assignedTwilioNumber }
            );
          }
        }
      }

      return NextResponse.json({ success: true, updated: result.count });
    }

    // Single update: { id: "...", status: "...", notes: "...", date: "...", startTime: "..." }
    const { id, ...data } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ success: false, error: "Appointment ID is required" }, { status: 400 });
    }

    const validated = updateAppointmentSchema.parse(data);

    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId },
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
        const validRescheduleItems = appointment.items.filter((i) => i.service != null) as AppointmentItemForCalc[];
        totalDuration = computeMultiItemDuration(validRescheduleItems);
      } else {
        const duration = appointment.serviceOption?.duration || appointment.service?.duration || 60;
        totalDuration = duration * (appointment.quantity || 1);
      }
      const [hours, minutes] = validated.startTime.split(":").map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + totalDuration;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

      updateData.date = new Date(validated.date);
      updateData.startTime = validated.startTime;
      updateData.endTime = endTime;

      // Overlap check + update in transaction to prevent race conditions
      const appointmentDate = new Date(validated.date + "T00:00:00.000Z");
      const endOfDay = new Date(validated.date + "T23:59:59.999Z");

      const tenantInfo = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { maxConcurrentBookings: true },
      });
      const maxConcurrent = tenantInfo?.maxConcurrentBookings ?? 1;

      const updated = await prisma.$transaction(async (tx) => {
        // Advisory lock on tenant+date prevents phantom reads from concurrent reschedules
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId + ':' + validated.date}))`;

        const overlappingCount = await tx.appointment.count({
          where: {
            tenantId,
            id: { not: id },
            date: { gte: appointmentDate, lte: endOfDay },
            status: { not: "CANCELLED" },
            AND: [
              { startTime: { lt: endTime } },
              { endTime: { gt: validated.startTime } },
            ],
          },
        });

        if (overlappingCount >= maxConcurrent) {
          return null;
        }

        return tx.appointment.update({
          where: { id },
          data: updateData,
          include: appointmentInclude,
        });
      });

      if (!updated) {
        return NextResponse.json(
          { success: false, error: "This time slot is fully booked" },
          { status: 409 }
        );
      }

      // Fire-and-forget: send confirmation SMS on PENDING→CONFIRMED
      if (validated.status === "CONFIRMED" && appointment.status === "PENDING") {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true, slug: true, assignedTwilioNumber: true },
        });
        if (tenant?.assignedTwilioNumber) {
          const dateStr = formatDateUTC(updated.date);
          const body = buildConfirmationSmsBody(tenant.name, tenant.slug, dateStr, updated.startTime);
          sendSmsWithConsent({
            tenantId,
            to: updated.customerPhone,
            from: tenant.assignedTwilioNumber,
            body,
            type: "APPOINTMENT_CONFIRMATION",
          }).catch((err) => console.error("Confirmation SMS error:", err));

          maybeSendImmediateReminder(
            { id: updated.id, tenantId, date: updated.date, startTime: updated.startTime, customerPhone: updated.customerPhone, reminderSentAt: updated.reminderSentAt },
            { name: tenant.name, slug: tenant.slug, assignedTwilioNumber: tenant.assignedTwilioNumber }
          );
        }
      }

      return NextResponse.json({ success: true, data: enrichAppointment(updated) });
    }

    const previousStatus = appointment.status;

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: appointmentInclude,
    });

    // Fire-and-forget: send confirmation SMS on PENDING→CONFIRMED
    if (validated.status === "CONFIRMED" && previousStatus === "PENDING") {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true, assignedTwilioNumber: true },
      });
      if (tenant?.assignedTwilioNumber) {
        const dateStr = formatDateUTC(updated.date);
        const body = buildConfirmationSmsBody(tenant.name, tenant.slug, dateStr, updated.startTime);
        sendSmsWithConsent({
          tenantId,
          to: updated.customerPhone,
          from: tenant.assignedTwilioNumber,
          body,
          type: "APPOINTMENT_CONFIRMATION",
        }).catch((err) => console.error("Confirmation SMS error:", err));

        // Send immediate reminder if appointment is within 12.5h (cron window already passed)
        maybeSendImmediateReminder(
          { id: updated.id, tenantId, date: updated.date, startTime: updated.startTime, customerPhone: updated.customerPhone, reminderSentAt: updated.reminderSentAt },
          { name: tenant.name, slug: tenant.slug, assignedTwilioNumber: tenant.assignedTwilioNumber }
        );
      }
    }

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
