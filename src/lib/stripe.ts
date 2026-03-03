import Stripe from "stripe";
import prisma from "./prisma";
import { SubscriptionStatus } from "@prisma/client";

const globalForStripe = globalThis as unknown as {
  stripe: Stripe | undefined;
};

function getStripeInstance(): Stripe {
  if (globalForStripe.stripe) return globalForStripe.stripe;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Return a placeholder during build - will fail at runtime if called without key
    return new Proxy({} as Stripe, {
      get() {
        throw new Error("STRIPE_SECRET_KEY is not configured");
      },
    });
  }

  const instance = new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2023-10-16" as any,
    typescript: true,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForStripe.stripe = instance;
  }

  return instance;
}

export const stripe = getStripeInstance();

export async function createStripeCustomer(email: string, name: string, tenantId: string) {
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { tenantId },
  });
  return customer;
}

export async function createCheckoutSession({
  customerId,
  priceId,
  tenantId,
  successUrl,
  cancelUrl,
}: {
  customerId: string;
  priceId: string;
  tenantId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tenantId },
    subscription_data: {
      metadata: { tenantId },
    },
  });
  return session;
}

export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
}

export async function getSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string) {
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/** Stripe status string → Prisma SubscriptionStatus enum */
export const STRIPE_STATUS_MAP: Record<string, SubscriptionStatus> = {
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "UNPAID",
  trialing: "TRIALING",
  incomplete: "INCOMPLETE",
};

/**
 * Upsert a Prisma Subscription from a Stripe subscription ID.
 * Used by both the Stripe webhook and the onboarding confirm flow.
 */
/** Extract period dates from a Stripe subscription (handles API version differences) */
function extractPeriodDates(sub: Record<string, unknown>): { start: Date; end: Date } {
  const startTs = sub.current_period_start as number | undefined;
  const endTs = sub.current_period_end as number | undefined;
  return {
    start: startTs ? new Date(startTs * 1000) : new Date(),
    end: endTs ? new Date(endTs * 1000) : new Date(),
  };
}

export async function upsertSubscriptionFromStripe(
  tenantId: string,
  subscriptionId: string
): Promise<boolean> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items?.data?.[0]?.price?.id;

  const plan = priceId
    ? await prisma.plan.findFirst({ where: { stripePriceId: priceId } })
    : null;

  if (!plan) return false;

  const subRecord = subscription as unknown as Record<string, unknown>;
  const stripeStatus = subRecord.status as string;
  const mappedStatus = STRIPE_STATUS_MAP[stripeStatus] || "ACTIVE";
  const cancelAtPeriodEnd = (subRecord.cancel_at_period_end as boolean) ?? false;

  const { start: periodStart, end: periodEnd } = extractPeriodDates(subRecord);

  await prisma.subscription.upsert({
    where: { tenantId },
    update: {
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      planId: plan.id,
      status: mappedStatus,
      cancelAtPeriodEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    create: {
      tenantId,
      planId: plan.id,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      status: mappedStatus,
      cancelAtPeriodEnd,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  return true;
}
