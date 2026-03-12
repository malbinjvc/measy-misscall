import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  createStripeCustomer,
  createCheckoutSession,
  changeSubscriptionPlan,
  upsertSubscriptionFromStripe,
} from "@/lib/stripe";
import { z } from "zod";

const changePlanSchema = z.object({
  planId: z.string().min(1),
  billingInterval: z.enum(["annual", "monthly"]).default("annual"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { planId, billingInterval } = changePlanSchema.parse(await req.json());
    const tenantId = session.user.tenantId;

    const [plan, tenant, currentSub] = await Promise.all([
      prisma.plan.findUnique({ where: { id: planId } }),
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.subscription.findUnique({
        where: { tenantId },
        select: { stripeSubscriptionId: true, planId: true, status: true },
      }),
    ]);

    // Pick the right Stripe price based on billing interval
    const priceId = billingInterval === "monthly"
      ? plan?.monthlyStripePriceId
      : plan?.stripePriceId;

    if (!plan || !priceId) {
      return NextResponse.json({ success: false, error: "Invalid plan or billing interval" }, { status: 400 });
    }
    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }
    if (currentSub?.planId === planId) {
      return NextResponse.json({ success: false, error: "Already on this plan" }, { status: 400 });
    }

    const origin =
      req.headers.get("origin") ||
      req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
      process.env.NEXT_PUBLIC_APP_URL;
    const baseUrl = origin?.replace(/\/$/, "") || "";

    // If tenant has an active Stripe subscription, swap the plan in-place (prorated)
    if (currentSub?.stripeSubscriptionId && currentSub.status === "ACTIVE") {
      const updated = await changeSubscriptionPlan(
        currentSub.stripeSubscriptionId,
        priceId
      );

      // Sync the updated subscription back to our DB
      await upsertSubscriptionFromStripe(tenantId, updated.id);

      return NextResponse.json({ success: true, data: { changed: true } });
    }

    // No active subscription — create a new Stripe Checkout session
    let stripeCustomerId = tenant.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await createStripeCustomer(tenant.email, tenant.name, tenantId);
      stripeCustomerId = customer.id;
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId },
      });
    }

    const checkoutSession = await createCheckoutSession({
      customerId: stripeCustomerId,
      priceId,
      tenantId,
      successUrl: `${baseUrl}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/dashboard/billing`,
    });

    return NextResponse.json({ success: true, data: { url: checkoutSession.url } });
  } catch (error: unknown) {
    console.error("Change plan error:", error);
    return NextResponse.json({ success: false, error: "Failed to change plan" }, { status: 500 });
  }
}
