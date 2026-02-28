import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/utils";

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await req.json();
    const { section, ...data } = body;

    switch (section) {
      case "profile": {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            name: data.name,
            slug: data.slug,
            email: data.email,
            phone: data.phone || null,
            address: data.address || null,
            city: data.city || null,
            state: data.state || null,
            zipCode: data.zipCode || null,
            description: data.description || null,
          },
        });
        break;
      }

      case "hours": {
        for (const h of data.hours) {
          await prisma.businessHours.upsert({
            where: { tenantId_day: { tenantId, day: h.day } },
            update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
            create: { tenantId, day: h.day, isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
          });
        }

        // Count future appointments that conflict with new hours
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const futureAppointments = await prisma.appointment.findMany({
          where: {
            tenantId,
            date: { gte: today },
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
          },
          select: { date: true, startTime: true, endTime: true },
        });

        const DAY_NAMES_UPPER = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
        const hoursMap = new Map(data.hours.map((h: any) => [h.day, h]));
        let affectedCount = 0;
        for (const apt of futureAppointments) {
          const dayName = DAY_NAMES_UPPER[new Date(apt.date).getUTCDay()];
          const bh = hoursMap.get(dayName) as any;
          if (!bh || !bh.isOpen) { affectedCount++; continue; }
          const [oh, om] = bh.openTime.split(":").map(Number);
          const [ch, cm] = bh.closeTime.split(":").map(Number);
          const openMin = oh * 60 + om;
          const closeMin = ch * 60 + cm;
          const [sh, sm] = apt.startTime.split(":").map(Number);
          const [eh, em] = apt.endTime.split(":").map(Number);
          const startMin = sh * 60 + sm;
          const endMin = eh * 60 + em;
          if (startMin < openMin || endMin > closeMin) affectedCount++;
        }

        return NextResponse.json({ success: true, affectedAppointments: affectedCount });
      }

      case "twilio": {
        const phoneNumber = normalizePhoneNumber(data.businessPhoneNumber);

        if (phoneNumber) {
          const existing = await prisma.tenant.findFirst({
            where: {
              businessPhoneNumber: phoneNumber,
              id: { not: tenantId },
            },
            select: { id: true },
          });

          if (existing) {
            return NextResponse.json(
              { success: false, error: "This business phone number is already in use by another business." },
              { status: 409 }
            );
          }
        }

        await prisma.tenant.update({
          where: { id: tenantId },
          data: { businessPhoneNumber: phoneNumber },
        });
        break;
      }

      case "media": {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            heroMediaUrl: data.heroMediaUrl || null,
            heroMediaType: data.heroMediaType || "image",
          },
        });
        break;
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid section" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 });
  }
}
