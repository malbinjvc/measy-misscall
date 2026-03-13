import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { DayOfWeek, Prisma } from "@prisma/client";
import { normalizePhoneNumber } from "@/lib/utils";
import { generateIvrAudio } from "@/lib/elevenlabs";
import { businessProfileSchema, businessHoursSchema, websiteConfigSchema } from "@/lib/validations";
import { migrateConfig } from "@/components/website-builder/migrate";
import { hasFeature, featureGatedResponse } from "@/lib/feature-gate";
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
          const currentTenant = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { slug: true, name: true },
          });

          if (profileData.slug && profileData.slug !== currentTenant?.slug) {
            const existingSlug = await tx.tenant.findFirst({
              where: { slug: profileData.slug, id: { not: tenantId } },
            });
            if (existingSlug) {
              return { slugTaken: true, nameChanged: false } as const;
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
              facebookUrl: profileData.facebookUrl || null,
              instagramUrl: profileData.instagramUrl || null,
              mapUrl: profileData.mapUrl || null,
              ...(profileData.autoConfirmAppointments !== undefined && {
                autoConfirmAppointments: profileData.autoConfirmAppointments,
              }),
              ...(profileData.maxConcurrentBookings !== undefined && {
                maxConcurrentBookings: profileData.maxConcurrentBookings,
              }),
            },
          });

          const nameChanged = profileData.name !== undefined && profileData.name !== currentTenant?.name;
          return { slugTaken: false, nameChanged } as const;
        });
        if (profileResult.slugTaken) {
          return NextResponse.json({ success: false, error: "Slug already taken" }, { status: 400 });
        }

        // Regenerate IVR audio when business name changes (fire-and-forget)
        if (profileResult.nameChanged && profileData.name) {
          generateIvrAudio(profileData.name, tenantId)
            .then(async (audioUrl) => {
              if (audioUrl) {
                await prisma.tenant.update({
                  where: { id: tenantId },
                  data: { ivrAudioUrl: audioUrl },
                });
              }
            })
            .catch((err) => {
              console.warn("IVR audio regeneration after name change failed (non-blocking):", err);
            });
        }
        break;
      }

      case "hours": {
        // Validate hours with Zod
        const hoursData = businessHoursSchema.parse(data);

        // Batch all upserts in a single transaction instead of N+1 sequential queries
        await prisma.$transaction(
          hoursData.hours.map((h: BusinessHoursInput) =>
            prisma.businessHours.upsert({
              where: { tenantId_day: { tenantId, day: h.day } },
              update: { isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
              create: { tenantId, day: h.day, isOpen: h.isOpen, openTime: h.openTime, closeTime: h.closeTime },
            })
          )
        );

        // Count future appointments that conflict with new hours using SQL
        // instead of loading all rows into memory
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const hoursMap = new Map<string, BusinessHoursInput>(hoursData.hours.map((h: BusinessHoursInput) => [h.day, h]));

        // Build conditions for each day's hours — appointments outside new hours are "affected"
        // Day-of-week in PG: 0=Sunday, 1=Monday, ... 6=Saturday
        const DAY_TO_DOW: Record<string, number> = {
          SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
          THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
        };

        // Count appointments on closed days + appointments outside open/close times
        const closedDows = hoursData.hours
          .filter((h: BusinessHoursInput) => !h.isOpen)
          .map((h: BusinessHoursInput) => DAY_TO_DOW[h.day]);

        const openDayConditions = hoursData.hours
          .filter((h: BusinessHoursInput) => h.isOpen)
          .map((h: BusinessHoursInput) => ({
            dow: DAY_TO_DOW[h.day],
            openTime: h.openTime,
            closeTime: h.closeTime,
          }));

        const affectedRows = await prisma.$queryRaw<[{ count: number }]>`
          SELECT COUNT(*)::int AS count
          FROM "Appointment" a
          WHERE a."tenantId" = ${tenantId}
            AND a.date >= ${today}
            AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
            AND (
              -- Appointments on closed days
              EXTRACT(DOW FROM a.date) = ANY(${closedDows}::int[])
              -- Appointments outside business hours for open days
              ${openDayConditions.length > 0
                ? Prisma.sql`OR ${Prisma.join(
                    openDayConditions.map((c) =>
                      Prisma.sql`(EXTRACT(DOW FROM a.date) = ${c.dow} AND (a."startTime" < ${c.openTime} OR a."endTime" > ${c.closeTime}))`
                    ),
                    " OR "
                  )}`
                : Prisma.empty
              }
            )
        `;

        return NextResponse.json({ success: true, affectedAppointments: affectedRows[0]?.count ?? 0 });
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

      case "website": {
        // Guard: reject payloads larger than 500KB
        const jsonStr = JSON.stringify(data.config);
        if (jsonStr.length > 500 * 1024) {
          return NextResponse.json(
            { success: false, error: "Website configuration is too large (max 500KB)" },
            { status: 400 }
          );
        }

        // Migrate legacy section types before validation
        const migratedConfig = migrateConfig(data.config);
        const websiteConfig = websiteConfigSchema.parse(migratedConfig);

        // Sync heroMediaUrl/heroMediaType from hero section for backward compat
        const heroSection = websiteConfig.sections.find((s) => s.type === "hero");
        const heroUpdate: Record<string, unknown> = {};
        if (heroSection && heroSection.type === "hero") {
          heroUpdate.heroMediaUrl = heroSection.mediaUrl || null;
          heroUpdate.heroMediaType = heroSection.mediaType || "image";
        }

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            websiteConfig: JSON.parse(JSON.stringify(websiteConfig)),
            ...heroUpdate,
          },
        });
        break;
      }

      case "domain": {
        if (!(await hasFeature(tenantId, "custom_domain"))) {
          return NextResponse.json(featureGatedResponse("Custom domain"), { status: 403 });
        }

        const domain = typeof data.customDomain === "string" ? data.customDomain.toLowerCase().trim() : null;

        if (domain) {
          const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
          if (!domainRegex.test(domain) || domain.length > 253) {
            return NextResponse.json({ success: false, error: "Invalid domain format" }, { status: 400 });
          }
          // Block main app domain
          const mainHost = new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost").hostname;
          if (domain === mainHost || domain.endsWith(`.${mainHost}`)) {
            return NextResponse.json({ success: false, error: "Cannot use the app domain" }, { status: 400 });
          }
          // Check uniqueness
          const existing = await prisma.tenant.findFirst({
            where: { customDomain: domain, id: { not: tenantId } },
            select: { id: true },
          });
          if (existing) {
            return NextResponse.json({ success: false, error: "This domain is already in use by another business" }, { status: 409 });
          }
        }

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            customDomain: domain || null,
            customDomainVerified: false, // reset verification on change
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
