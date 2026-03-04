import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePhoneNumber } from "@/lib/utils";
import { generateIvrAudio } from "@/lib/elevenlabs";
import { businessProfileSchema, onboardingStepSchema } from "@/lib/validations";
import { z, ZodError } from "zod";
import { getSampleServicesForIndustry } from "@/data/sample-services";

const STEP_ORDER = [
  "BUSINESS_PROFILE",
  "INDUSTRY",
  "SUBSCRIPTION",
  "REVIEW",
] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { step, data } = onboardingStepSchema.parse(await req.json());
    const tenantId = session.user.tenantId;

    // Handle backward navigation
    if (step === "GO_BACK") {
      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { onboardingStep: true },
        });
        if (!tenant) return { error: "NOT_FOUND" } as const;

        const currentIndex = STEP_ORDER.indexOf(tenant.onboardingStep as typeof STEP_ORDER[number]);
        if (currentIndex <= 0) return { error: "FIRST_STEP" } as const;

        await tx.tenant.update({
          where: { id: tenantId },
          data: { onboardingStep: STEP_ORDER[currentIndex - 1] },
        });
        return { success: true } as const;
      });

      if ("error" in result) {
        if (result.error === "NOT_FOUND") {
          return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
        }
        return NextResponse.json({ success: false, error: "Already at first step" }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    // Handle Stripe return — verify session and advance step
    if (step === "CONFIRM_SUBSCRIPTION") {
      const sessionId = data.sessionId;
      if (!sessionId) {
        return NextResponse.json({ success: false, error: "Session ID required" }, { status: 400 });
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { onboardingStep: true },
      });

      // Already advanced (webhook handled it)
      if (tenant?.onboardingStep === "REVIEW") {
        return NextResponse.json({ success: true });
      }

      // Verify the checkout session with Stripe
      const { stripe } = await import("@/lib/stripe");
      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

      if (
        checkoutSession.payment_status !== "paid" ||
        checkoutSession.metadata?.tenantId !== tenantId
      ) {
        return NextResponse.json(
          { success: false, error: "Payment not completed" },
          { status: 400 }
        );
      }

      // Create subscription if webhook hasn't done it yet
      const subscriptionId = checkoutSession.subscription as string;
      if (subscriptionId) {
        const { upsertSubscriptionFromStripe } = await import("@/lib/stripe");
        await upsertSubscriptionFromStripe(tenantId, subscriptionId);
      }

      // Advance to REVIEW
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { onboardingStep: "REVIEW" },
      });

      return NextResponse.json({ success: true });
    }

    switch (step) {
      case "BUSINESS_PROFILE": {
        // Validate required fields with Zod
        const profileData = businessProfileSchema.parse(data);

        const normalizedBusinessPhone = normalizePhoneNumber(profileData.businessPhoneNumber);
        const normalizedNewPhone = normalizePhoneNumber(profileData.phone);

        // All checks and updates in a single transaction for atomicity
        const profileResult = await prisma.$transaction(async (tx) => {
          // Check businessPhoneNumber uniqueness
          if (normalizedBusinessPhone) {
            const existing = await tx.tenant.findFirst({
              where: { businessPhoneNumber: normalizedBusinessPhone, id: { not: tenantId } },
            });
            if (existing) return { error: "PHONE_TAKEN" } as const;
          }

          // Get current tenant
          const currentTenant = await tx.tenant.findUnique({
            where: { id: tenantId },
            select: { phone: true, phoneVerified: true, slug: true },
          });

          // Check slug uniqueness
          if (profileData.slug && profileData.slug !== currentTenant?.slug) {
            const existingSlug = await tx.tenant.findFirst({
              where: { slug: profileData.slug, id: { not: tenantId } },
            });
            if (existingSlug) return { error: "SLUG_TAKEN" } as const;
          }

          // Determine phoneVerified status
          const normalizedCurrentPhone = normalizePhoneNumber(currentTenant?.phone);
          const phoneChanged = normalizedNewPhone !== normalizedCurrentPhone;
          const phoneVerified = phoneChanged ? false : (currentTenant?.phoneVerified ?? false);

          if (!phoneVerified) return { error: "PHONE_NOT_VERIFIED" } as const;

          // Update profile
          await tx.tenant.update({
            where: { id: tenantId },
            data: {
              name: profileData.name,
              slug: profileData.slug,
              email: profileData.email,
              phone: normalizedNewPhone,
              address: profileData.address || null,
              city: profileData.city || null,
              state: profileData.state || null,
              zipCode: profileData.zipCode || null,
              businessPhoneNumber: normalizedBusinessPhone,
              onboardingStep: "INDUSTRY",
              ...(phoneChanged ? { phoneVerified: false } : {}),
            },
          });
          return { success: true } as const;
        });

        if ("error" in profileResult) {
          if (profileResult.error === "PHONE_TAKEN") {
            return NextResponse.json(
              { success: false, error: "This business phone number is already registered" },
              { status: 400 }
            );
          }
          if (profileResult.error === "SLUG_TAKEN") {
            return NextResponse.json(
              { success: false, error: "Slug already taken" },
              { status: 400 }
            );
          }
          return NextResponse.json(
            { success: false, error: "Please verify your phone number first." },
            { status: 400 }
          );
        }
        break;
      }

      case "INDUSTRY": {
        const industrySchema = z.object({
          industry: z.string().min(1, "Please select an industry"),
          description: z.string().optional(),
        });
        const industryData = industrySchema.parse(data);

        await prisma.$transaction(async (tx) => {
          await tx.tenant.update({
            where: { id: tenantId },
            data: {
              industry: industryData.industry,
              description: industryData.description || null,
              onboardingStep: "SUBSCRIPTION",
            },
          });

          const existingCount = await tx.service.count({ where: { tenantId } });
          if (existingCount === 0) {
            const sampleServices = getSampleServicesForIndustry(industryData.industry);
            for (let i = 0; i < sampleServices.length; i++) {
              const s = sampleServices[i];
              await tx.service.create({
                data: {
                  tenantId,
                  name: s.name,
                  description: s.description,
                  duration: s.duration,
                  price: s.price,
                  sortOrder: i,
                  ...(s.options?.length
                    ? {
                        options: {
                          createMany: {
                            data: s.options.map((o, j) => ({
                              name: o.name,
                              description: o.description,
                              price: o.price,
                              duration: o.duration,
                              sortOrder: j,
                            })),
                          },
                        },
                      }
                    : {}),
                },
              });
            }
          }
        });
        break;
      }

      case "SUBSCRIPTION": {
        const subscriptionSchema = z.object({
          planId: z.string().min(1, "Plan ID is required").optional(),
        });
        const subscriptionData = subscriptionSchema.parse(data);

        if (subscriptionData.planId) {
          // Atomic read of plan + tenant
          const { plan, tenant: subTenant } = await prisma.$transaction(async (tx) => {
            const plan = await tx.plan.findUnique({ where: { id: subscriptionData.planId! } });
            const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
            return { plan, tenant };
          });

          if (!plan) {
            return NextResponse.json({ success: false, error: "Plan not found" }, { status: 400 });
          }

          // If Stripe is configured, create checkout session
          if (plan.stripePriceId && process.env.STRIPE_SECRET_KEY) {
            const { createStripeCustomer, createCheckoutSession } = await import("@/lib/stripe");

            if (!subTenant) {
              return NextResponse.json(
                { success: false, error: "Tenant not found" },
                { status: 404 }
              );
            }

            let stripeCustomerId = subTenant.stripeCustomerId;
            if (!stripeCustomerId) {
              const customer = await createStripeCustomer(
                subTenant.email,
                subTenant.name,
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

          // No Stripe — create free subscription
          await prisma.subscription.upsert({
            where: { tenantId },
            update: { planId: subscriptionData.planId, status: "ACTIVE" },
            create: {
              tenantId,
              planId: subscriptionData.planId,
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
    console.error("Onboarding error:", error);
    const message = "Onboarding failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
