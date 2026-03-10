import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DayOfWeek } from "@prisma/client";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { updateCustomerSchema } from "@/lib/validations";
import { timeStringToMinutes, normalizePhoneForStorage } from "@/lib/utils";
import { ZodError } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const payload = await getCustomerFromRequest(req);
    if (!payload || payload.tenantId !== tenant.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
      include: {
        vehicles: {
          orderBy: { updatedAt: "desc" },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    // Match appointments by exact phone or last-10-digit suffix (handles legacy format differences)
    const normalizedPhone = normalizePhoneForStorage(customer.phone);
    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { customerPhone: customer.phone },
          { customerPhone: normalizedPhone },
          ...(normalizedPhone.length === 10 ? [{ customerPhone: { endsWith: normalizedPhone } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      include: {
        service: { select: { id: true, name: true, duration: true, price: true } },
        serviceOption: { select: { id: true, name: true, duration: true, price: true } },
        items: {
          include: {
            service: { select: { id: true, name: true, duration: true, price: true } },
            serviceOption: { select: { id: true, name: true, duration: true, price: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      take: 50,
    });

    return NextResponse.json(
      { success: true, data: { customer, appointments } },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache" } }
    );
  } catch (error) {
    console.error("Customer account GET error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const payload = await getCustomerFromRequest(req);
    if (!payload || payload.tenantId !== tenant.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const validated = updateCustomerSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.email !== undefined) updateData.email = validated.email || null;
    if (validated.smsConsent !== undefined) updateData.smsConsent = validated.smsConsent;

    const customer = await prisma.customer.update({
      where: { id: payload.customerId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Customer account PATCH error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

// Cancel or reschedule an appointment
export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const payload = await getCustomerFromRequest(req);
    if (!payload || payload.tenantId !== tenant.id) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: payload.customerId },
    });
    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const body = await req.json();
    const { appointmentId, action, date, startTime } = body;

    if (!appointmentId || typeof appointmentId !== "string") {
      return NextResponse.json({ success: false, error: "Appointment ID is required" }, { status: 400 });
    }

    // Verify the appointment belongs to this customer
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        tenantId: tenant.id,
        customerPhone: customer.phone,
      },
      include: {
        service: true,
        serviceOption: true,
        items: {
          include: {
            service: true,
            serviceOption: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ success: false, error: "Appointment not found" }, { status: 404 });
    }

    // Only PENDING or CONFIRMED appointments can be modified
    if (!["PENDING", "CONFIRMED"].includes(appointment.status)) {
      return NextResponse.json({ success: false, error: "This appointment cannot be modified" }, { status: 400 });
    }

    if (action === "cancel") {
      // Limit: max 3 cancellations per 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentCancellations = await prisma.appointment.count({
        where: {
          tenantId: tenant.id,
          customerPhone: customer.phone,
          status: "CANCELLED",
          updatedAt: { gte: sevenDaysAgo },
        },
      });

      if (recentCancellations >= 10) {
        return NextResponse.json(
          { success: false, error: "You have reached the maximum of 3 cancellations in 7 days. Please try again later." },
          { status: 400 }
        );
      }

      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: "CANCELLED" },
        include: {
          service: { select: { id: true, name: true, duration: true, price: true } },
          serviceOption: { select: { id: true, name: true, duration: true, price: true } },
          items: {
            include: {
              service: { select: { id: true, name: true, duration: true, price: true } },
              serviceOption: { select: { id: true, name: true, duration: true, price: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "reschedule") {
      if (!date || !startTime) {
        return NextResponse.json({ success: false, error: "Date and time are required" }, { status: 400 });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ success: false, error: "Invalid date format" }, { status: 400 });
      }

      // Validate not in the past
      const today = new Date().toISOString().split("T")[0];
      if (date < today) {
        return NextResponse.json({ success: false, error: "Cannot reschedule to a past date" }, { status: 400 });
      }

      // Validate business hours
      const [yr, mo, dy] = date.split("-").map(Number);
      const dateObj = new Date(yr, mo - 1, dy);
      const daysMap = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
      const dayOfWeek = daysMap[dateObj.getDay()];

      const businessHours = await prisma.businessHours.findUnique({
        where: { tenantId_day: { tenantId: tenant.id, day: dayOfWeek as DayOfWeek } },
      });

      if (!businessHours || !businessHours.isOpen) {
        return NextResponse.json({ success: false, error: "Business is closed on this day" }, { status: 400 });
      }

      // Calculate end time from service duration (use items when available)
      let totalDuration: number;
      if (appointment.items && appointment.items.length > 0) {
        totalDuration = appointment.items.reduce((sum, item) => {
          const dur = item.serviceOption?.duration ?? item.service.duration;
          return sum + dur * item.quantity;
        }, 0);
      } else {
        const duration = appointment.serviceOption?.duration || appointment.service?.duration || 60;
        totalDuration = duration * (appointment.quantity || 1);
      }
      const [hours, minutes] = startTime.split(":").map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + totalDuration;
      const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

      // Validate within business hours
      const openMinutes = timeStringToMinutes(businessHours.openTime);
      const closeMinutes = timeStringToMinutes(businessHours.closeTime);
      if (startMinutes < openMinutes || endMinutes > closeMinutes) {
        return NextResponse.json({ success: false, error: "Selected time is outside business hours" }, { status: 400 });
      }

      // Check overlapping appointments
      const appointmentDate = new Date(date + "T00:00:00.000Z");
      const endOfDay = new Date(date + "T23:59:59.999Z");

      const overlapping = await prisma.appointment.findFirst({
        where: {
          tenantId: tenant.id,
          id: { not: appointmentId },
          date: { gte: appointmentDate, lte: endOfDay },
          status: { not: "CANCELLED" },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: startTime } },
          ],
        },
      });

      if (overlapping) {
        return NextResponse.json({ success: false, error: "This time slot is already booked" }, { status: 409 });
      }

      const updated = await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          date: new Date(date),
          startTime,
          endTime,
        },
        include: {
          service: { select: { id: true, name: true, duration: true, price: true } },
          serviceOption: { select: { id: true, name: true, duration: true, price: true } },
          items: {
            include: {
              service: { select: { id: true, name: true, duration: true, price: true } },
              serviceOption: { select: { id: true, name: true, duration: true, price: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Customer appointment action error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
