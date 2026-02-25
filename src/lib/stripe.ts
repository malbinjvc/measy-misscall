import Stripe from "stripe";

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
