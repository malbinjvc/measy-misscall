import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { DayOfWeek } from "@prisma/client";
import { createAppointmentSchema } from "@/lib/validations";
import { timeStringToMinutes } from "@/lib/utils";
import { ZodError } from "zod";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashOtp } from "@/lib/crypto";
import { getCustomerFromRequest, signCustomerToken, setCustomerCookie } from "@/lib/customer-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`book:${ip}`, { max: 30, windowSec: 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const body = await req.json();
    const validated = createAppointmentSchema.parse(body);

    // Skip phone verification if customer is logged in with the same phone
    const customerPayload = await getCustomerFromRequest(req);
    const last10 = (p: string) => p.replace(/\D/g, "").slice(-10);
    const isLoggedInWithSamePhone =
      customerPayload &&
      customerPayload.tenantId === tenant.id &&
      last10(customerPayload.phone).length === 10 &&
      last10(customerPayload.phone) === last10(validated.customerPhone);

    if (!isLoggedInWithSamePhone) {
      // Public booking requires phone verification
      if (!validated.verificationCode) {
        return NextResponse.json(
          { success: false, error: "Phone verification is required" },
          { status: 400 }
        );
      }

      // Hash the incoming verification code to compare against stored hash
      const hashedVerificationCode = hashOtp(validated.verificationCode);

      // Atomically claim the verification code to prevent race conditions.
      const claimed = await prisma.phoneVerification.updateMany({
        where: {
          phone: validated.customerPhone,
          code: hashedVerificationCode,
          verified: false,
          expiresAt: { gte: new Date() },
        },
        data: { verified: true },
      });

      if (claimed.count === 0) {
        return NextResponse.json(
          { success: false, error: "Invalid or expired verification code. Please verify your phone number." },
          { status: 400 }
        );
      }
    }

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
        where: { id: item.serviceId, tenantId: tenant.id, isActive: true },
      });
      if (!service) {
        return NextResponse.json({ success: false, error: `Service not found` }, { status: 404 });
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
          return NextResponse.json({ success: false, error: "Service option not found" }, { status: 404 });
        }
        if (option.duration) duration = option.duration;
        serviceOptionId = option.id;
        if (quantity < option.minQuantity) quantity = option.minQuantity;
        if (quantity > option.maxQuantity) quantity = option.maxQuantity;

        if (item.selectedSubOptionIds?.length) {
          const validSubIds = option.subOptions.map((s) => s.id);
          for (const subId of item.selectedSubOptionIds) {
            if (!validSubIds.includes(subId)) {
              return NextResponse.json({ success: false, error: "Invalid sub-option selected" }, { status: 400 });
            }
          }
          selectedSubOptions = item.selectedSubOptionIds;
        }
      }

      totalDuration += duration * quantity;
      validatedItems.push({ serviceId: item.serviceId, serviceOptionId, quantity, selectedSubOptions, sortOrder: i });
    }

    // Calculate end time
    const [hours, minutes] = validated.startTime.split(":").map(Number);
    const startMinutes = hours * 60 + minutes;
    const endMinutes = startMinutes + totalDuration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, "0")}:${(endMinutes % 60).toString().padStart(2, "0")}`;

    // Reject past dates
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (validated.date < todayStr) {
      return NextResponse.json({ success: false, error: "Cannot book for a past date" }, { status: 400 });
    }

    // Validate business hours
    const [yr, mo, dy] = validated.date.split("-").map(Number);
    const dateObj = new Date(yr, mo - 1, dy);
    const daysMap = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const dayOfWeek = daysMap[dateObj.getDay()];
    const businessHours = await prisma.businessHours.findUnique({
      where: { tenantId_day: { tenantId: tenant.id, day: dayOfWeek as DayOfWeek } },
    });

    if (!businessHours || !businessHours.isOpen) {
      return NextResponse.json({ success: false, error: "Business is closed on this day" }, { status: 400 });
    }

    const openMinutes = timeStringToMinutes(businessHours.openTime);
    const closeMinutes = timeStringToMinutes(businessHours.closeTime);

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      return NextResponse.json({ success: false, error: "Selected time is outside business hours" }, { status: 400 });
    }

    // Limit: max 3 active bookings per customer per tenant
    const activeCount = await prisma.appointment.count({
      where: {
        tenantId: tenant.id,
        customerPhone: validated.customerPhone,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    if (activeCount >= 10) {
      return NextResponse.json(
        { success: false, error: "You already have 3 active appointments. Please cancel or complete an existing one before booking again." },
        { status: 400 }
      );
    }

    // Check for overlapping appointments and create atomically
    const appointmentDate = new Date(validated.date + "T00:00:00.000Z");
    const endOfDay = new Date(validated.date + "T23:59:59.999Z");

    const { appointment, customer } = await prisma.$transaction(async (tx) => {
      const overlapping = await tx.appointment.findFirst({
        where: {
          tenantId: tenant.id,
          date: { gte: appointmentDate, lte: endOfDay },
          status: { not: "CANCELLED" },
          AND: [
            { startTime: { lt: endTime } },
            { endTime: { gt: validated.startTime } },
          ],
        },
      });

      if (overlapping) {
        throw { code: "OVERLAP" };
      }

      // Upsert customer profile
      const customer = await tx.customer.upsert({
        where: { tenantId_phone: { tenantId: tenant.id, phone: validated.customerPhone } },
        create: {
          tenantId: tenant.id,
          name: validated.customerName,
          phone: validated.customerPhone,
          email: validated.customerEmail || null,
          smsConsent: body.smsConsent === true,
          vehicleYear: validated.vehicleYear || null,
          vehicleMake: validated.vehicleMake || null,
          vehicleModel: validated.vehicleModel || null,
          vehicleType: validated.vehicleType || null,
        },
        update: {
          name: validated.customerName,
          email: validated.customerEmail || undefined,
          smsConsent: body.smsConsent === true ? true : undefined,
          vehicleYear: validated.vehicleYear || undefined,
          vehicleMake: validated.vehicleMake || undefined,
          vehicleModel: validated.vehicleModel || undefined,
          vehicleType: validated.vehicleType || undefined,
        },
      });

      // Save vehicle to CustomerVehicle for multi-vehicle history
      if (validated.vehicleYear && validated.vehicleMake && validated.vehicleModel) {
        await tx.customerVehicle.upsert({
          where: {
            customerId_vehicleYear_vehicleMake_vehicleModel: {
              customerId: customer.id,
              vehicleYear: validated.vehicleYear,
              vehicleMake: validated.vehicleMake,
              vehicleModel: validated.vehicleModel,
            },
          },
          create: {
            customerId: customer.id,
            vehicleYear: validated.vehicleYear,
            vehicleType: validated.vehicleType || null,
            vehicleMake: validated.vehicleMake,
            vehicleModel: validated.vehicleModel,
          },
          update: {
            vehicleType: validated.vehicleType || undefined,
            updatedAt: new Date(),
          },
        });
      }

      const appt = await tx.appointment.create({
        data: {
          tenantId: tenant.id,
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
          smsConsent: body.smsConsent === true,
          status: tenant.autoConfirmAppointments ? "CONFIRMED" : "PENDING",
        },
      });

      return { appointment: appt, customer };
    });

    // Auto-login: set customer auth cookie so they can access their account
    const token = await signCustomerToken({
      customerId: customer.id,
      tenantId: tenant.id,
      phone: customer.phone,
    });
    const response = NextResponse.json({ success: true, data: appointment });
    setCustomerCookie(response, token);
    return response;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed", details: error.issues }, { status: 400 });
    }
    if ((error as {code?: string}).code === "OVERLAP") {
      return NextResponse.json({ success: false, error: "This time slot is already booked" }, { status: 409 });
    }
    console.error("Booking error:", error);
    return NextResponse.json({ success: false, error: "Booking failed" }, { status: 500 });
  }
}
