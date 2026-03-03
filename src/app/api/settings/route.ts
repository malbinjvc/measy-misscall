import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DayOfWeek } from "@prisma/client";
import { normalizePhoneNumber } from "@/lib/utils";
import { businessProfileSchema, businessHoursSchema } from "@/lib/validations";
import { ZodError } from "zod";

interface BusinessHoursInput {
  day: DayOfWeek;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

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
        // Validate profile fields with Zod (partial — only validate provided fields)
        const profileData = businessProfileSchema
          .omit({ businessPhoneNumber: true })
          .partial()
          .parse(data);

        // Atomically check slug uniqueness and update in a transaction
        const profileResult = await prisma.$transaction(async (tx) => {
          if (profileData.slug) {
            const currentTenant = await tx.tenant.findUnique({
              where: { id: tenantId },
              select: { slug: true },
            });
            if (profileData.slug !== currentTenant?.slug) {
              const existingSlug = await tx.tenant.findFirst({
                where: { slug: profileData.slug, id: { not: tenantId } },
              });
              if (existingSlug) {
                return { slugTaken: true } as const;
              }
            }
          }

          await tx.tenant.update({
            where: { id: tenantId },
            data: {
              name: profileData.name,
              slug: profileData.slug,
              email: profileData.email,
              phone: profileData.phone || null,
              address: profileData.address || null,
              city: profileData.city || null,
              state: profileData.state || null,
              zipCode: profileData.zipCode || null,
              description: profileData.description || null,
            },
          });
          return { slugTaken: false } as const;
        });
        if (profileResult.slugTaken) {
          return NextResponse.json({ success: false, error: "Slug already taken" }, { status: 400 });
        }
        break;
      }

      case "hours": {
        // Validate hours with Zod
        const hoursData = businessHoursSchema.parse(data);

        for (const h of hoursData.hours) {
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
        const hoursMap = new Map<string, BusinessHoursInput>(hoursData.hours.map((h: BusinessHoursInput) => [h.day, h]));
        let affectedCount = 0;
        for (const apt of futureAppointments) {
          const dayName = DAY_NAMES_UPPER[new Date(apt.date).getUTCDay()];
          const bh = hoursMap.get(dayName);
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
    console.error("Settings update error:", error);
    return NextResponse.json({ success: false, error: "Failed to save settings" }, { status: 500 });
  }
}
