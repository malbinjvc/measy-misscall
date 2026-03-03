import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createStripeCustomer, createCheckoutSession } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = checkoutSchema.parse(await req.json());
    const tenantId = session.user.tenantId;

    // Atomic read of plan + tenant, then conditional Stripe customer creation
    const { plan, tenant } = await prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      return { plan, tenant };
    });

    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ success: false, error: "Invalid plan" }, { status: 400 });
    }

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

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
      priceId: plan.stripePriceId,
      tenantId,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ success: true, data: { url: checkoutSession.url } });
  } catch (error: unknown) {
    console.error("Checkout error:", error);
    return NextResponse.json({ success: false, error: "Failed to create checkout" }, { status: 500 });
  }
}
