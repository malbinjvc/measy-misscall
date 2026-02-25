import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import Stripe from "stripe";

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
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenantId;
        const subscriptionId = session.subscription as string;

        if (tenantId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
          const priceId = subscription.items?.data?.[0]?.price?.id;

          // Find matching plan
          const plan = priceId
            ? await prisma.plan.findFirst({ where: { stripePriceId: priceId } })
            : null;

          if (plan) {
            const periodStart = subscription.current_period_start
              ? new Date(subscription.current_period_start * 1000)
              : new Date();
            const periodEnd = subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : new Date();

            await prisma.subscription.upsert({
              where: { tenantId },
              update: {
                stripeSubscriptionId: subscriptionId,
                stripePriceId: priceId,
                planId: plan.id,
                status: "ACTIVE",
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              },
              create: {
                tenantId,
                planId: plan.id,
                stripeSubscriptionId: subscriptionId,
                stripePriceId: priceId,
                status: "ACTIVE",
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              },
            });
          }
        }
        break;
      }

      case "invoice.paid": {
        const paidInvoice = event.data.object as any;
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
        const failedInvoice = event.data.object as any;
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
        const sub = event.data.object as any;
        const statusMap: Record<string, string> = {
          active: "ACTIVE",
          past_due: "PAST_DUE",
          canceled: "CANCELED",
          unpaid: "UNPAID",
          trialing: "TRIALING",
          incomplete: "INCOMPLETE",
        };

        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: (statusMap[sub.status] || "ACTIVE") as any,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            currentPeriodStart: sub.current_period_start
              ? new Date(sub.current_period_start * 1000)
              : undefined,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : undefined,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as any;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: deletedSub.id },
          data: { status: "CANCELED" },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
