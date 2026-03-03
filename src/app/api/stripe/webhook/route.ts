import { NextRequest, NextResponse } from "next/server";
import { stripe, upsertSubscriptionFromStripe, STRIPE_STATUS_MAP } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";
import { getErrorMessage } from "@/lib/errors";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: unknown) {
    console.error("Webhook signature verification failed:", getErrorMessage(err));
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const subscriptionId = session.subscription as string;

        if (tenantId && subscriptionId) {
          await upsertSubscriptionFromStripe(tenantId, subscriptionId);

          // Advance onboarding step if tenant is still on SUBSCRIPTION
          await prisma.tenant.updateMany({
            where: { id: tenantId, onboardingStep: "SUBSCRIPTION" },
            data: { onboardingStep: "REVIEW" },
          });
        }
        break;
      }

      case "invoice.paid": {
        const paidInvoice = event.data.object as unknown as Record<string, unknown>;
        const paidSubId = paidInvoice.subscription as string;
        if (paidSubId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: paidSubId },
            data: { status: "ACTIVE" },
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as unknown as Record<string, unknown>;
        const failedSubId = failedInvoice.subscription as string;
        if (failedSubId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: failedSubId },
            data: { status: "PAST_DUE" },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as unknown as Record<string, unknown>;
        const subStatus = sub.status as string;
        const mappedStatus = STRIPE_STATUS_MAP[subStatus] || "ACTIVE";
        const periodStart = sub.current_period_start as number | undefined;
        const periodEnd = sub.current_period_end as number | undefined;

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id as string },
          data: {
            status: mappedStatus,
            cancelAtPeriodEnd: (sub.cancel_at_period_end as boolean) ?? false,
            currentPeriodStart: periodStart
              ? new Date(periodStart * 1000)
              : undefined,
            currentPeriodEnd: periodEnd
              ? new Date(periodEnd * 1000)
              : undefined,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as unknown as Record<string, unknown>;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: deletedSub.id as string },
          data: { status: "CANCELED" },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
