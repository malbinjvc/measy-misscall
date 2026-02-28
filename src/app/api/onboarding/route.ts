import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/utils";
import { generateIvrAudio } from "@/lib/elevenlabs";

const STEP_ORDER = [
  "BUSINESS_PROFILE",
  "SERVICES",
  "SUBSCRIPTION",
  "REVIEW",
] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { step, data } = await req.json();
    const tenantId = session.user.tenantId;

    switch (step) {
      case "BUSINESS_PROFILE": {
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
            businessPhoneNumber: normalizePhoneNumber(data.businessPhoneNumber),
            onboardingStep: "SERVICES",
          },
        });
        break;
      }

      case "SERVICES": {
        // Delete existing services and recreate
        await prisma.service.deleteMany({ where: { tenantId } });

        if (data.services && data.services.length > 0) {
          await prisma.service.createMany({
            data: data.services.map((s: any, index: number) => ({
              name: s.name,
              duration: s.duration || 60,
              price: s.price || null,
              tenantId,
              sortOrder: index,
            })),
          });
        }

        await prisma.tenant.update({
          where: { id: tenantId },
          data: { onboardingStep: "SUBSCRIPTION" },
        });
        break;
      }

      case "SUBSCRIPTION": {
        // Create a basic subscription (Stripe integration will be handled via checkout)
        if (data.planId) {
          const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
          if (!plan) {
            return NextResponse.json({ success: false, error: "Plan not found" }, { status: 400 });
          }

          // If Stripe is configured, create checkout session
          if (plan.stripePriceId && process.env.STRIPE_SECRET_KEY) {
            const { createStripeCustomer, createCheckoutSession } = await import("@/lib/stripe");
            const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

            let stripeCustomerId = tenant?.stripeCustomerId;
            if (!stripeCustomerId) {
              const customer = await createStripeCustomer(
                tenant!.email,
                tenant!.name,
                tenantId
              );
              stripeCustomerId = customer.id;
              await prisma.tenant.update({
                where: { id: tenantId },
                data: { stripeCustomerId },
              });
            }

            const checkoutSession = await createCheckoutSession({
              customerId: stripeCustomerId,
              priceId: plan.stripePriceId,
              tenantId,
              successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/onboarding?session_id={CHECKOUT_SESSION_ID}`,
              cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/onboarding`,
            });

            return NextResponse.json({
              success: true,
              data: { checkoutUrl: checkoutSession.url },
            });
          }

          // No Stripe - create free subscription
          await prisma.subscription.upsert({
            where: { tenantId },
            update: { planId: data.planId, status: "ACTIVE" },
            create: {
              tenantId,
              planId: data.planId,
              status: "ACTIVE",
            },
          });
        }

        await prisma.tenant.update({
          where: { id: tenantId },
          data: { onboardingStep: "REVIEW" },
        });
        break;
      }

      case "REVIEW": {
        // Create default business hours if not exists
        const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
        for (const day of days) {
          await prisma.businessHours.upsert({
            where: { tenantId_day: { tenantId, day } },
            update: {},
            create: {
              tenantId,
              day,
              isOpen: day !== "SUNDAY",
              openTime: "09:00",
              closeTime: day === "SATURDAY" ? "14:00" : "17:00",
            },
          });
        }

        const activeTenant = await prisma.tenant.update({
          where: { id: tenantId },
          data: { status: "ACTIVE" },
        });

        // Fire-and-forget: generate IVR audio via ElevenLabs
        generateIvrAudio(activeTenant.name, tenantId)
          .then(async (audioUrl) => {
            if (audioUrl) {
              await prisma.tenant.update({
                where: { id: tenantId },
                data: { ivrAudioUrl: audioUrl },
              });
            }
          })
          .catch((err) => {
            console.warn("IVR audio generation failed (non-blocking):", err);
          });

        break;
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid step" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Onboarding failed" },
      { status: 500 }
    );
  }
}
