import prisma from "./prisma";
import { stripe } from "./stripe";
import { calculateTotalWithFees } from "./tax";

const RATE_PER_UNIT = 0.035; // $0.035 CAD per SMS or per call minute
// Monthly premium and tax are handled in src/lib/tax.ts

/**
 * Get or create a wallet for a tenant.
 */
export async function getOrCreateWallet(tenantId: string) {
  return prisma.wallet.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, balance: 0 },
  });
}

/**
 * Ensure the wallet counters belong to the current billing period.
 * If the period has changed, reset counters atomically.
 */
async function ensureCurrentPeriod(tenantId: string): Promise<Date> {
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { currentPeriodStart: true },
  });

  const currentPeriodStart = subscription?.currentPeriodStart
    || new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  // Reset counters if period has changed (atomic — only resets if periodStart differs)
  await prisma.wallet.updateMany({
    where: {
      tenantId,
      OR: [
        { periodStart: null },
        { periodStart: { lt: currentPeriodStart } },
      ],
    },
    data: {
      usedSms: 0,
      usedCalls: 0,
      periodStart: currentPeriodStart,
    },
  });

  return currentPeriodStart;
}

/**
 * Add funds to a wallet atomically and record the transaction.
 */
export async function addFunds(
  tenantId: string,
  amount: number,
  type: string,
  description: string,
  stripePaymentIntentId?: string
) {
  // Atomic increment — no read-then-write race condition
  const updatedWallet = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.update({
      where: { tenantId },
      data: { balance: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type,
        amount,
        balance: wallet.balance,
        description,
        stripePaymentIntentId,
      },
    });
    return wallet;
  });

  return updatedWallet;
}

/**
 * Charge wallet for usage beyond free tier.
 * Uses atomic counter increment for free tier check and atomic decrement for balance.
 * Zero COUNT queries — O(1) regardless of table size.
 */
export async function chargeForUsage(
  tenantId: string,
  usageType: "sms" | "call",
  units: number = 1
): Promise<{ charged: boolean; amount: number; withinFreeTier: boolean }> {
  // Ensure wallet exists and counters are for current billing period
  await getOrCreateWallet(tenantId);
  await ensureCurrentPeriod(tenantId);

  // Get plan limits
  const subscription = await prisma.subscription.findUnique({
    where: { tenantId },
    select: { plan: { select: { maxSms: true, maxCalls: true } } },
  });

  const limit = usageType === "sms"
    ? (subscription?.plan?.maxSms || 0)
    : (subscription?.plan?.maxCalls || 0);

  const counterField = usageType === "sms" ? "usedSms" : "usedCalls";

  // Single transaction: increment counter, read new value, charge if needed
  // This eliminates the race window between reading and incrementing
  const result = await prisma.$transaction(async (tx) => {
    // Atomically increment and get the NEW counter value
    const updated = await tx.wallet.update({
      where: { tenantId },
      data: { [counterField]: { increment: units } },
    });

    const newUsed = usageType === "sms" ? updated.usedSms : updated.usedCalls;

    // If within free tier after increment, no charge needed
    if (newUsed <= limit) {
      return { charged: false, amount: 0, withinFreeTier: true };
    }

    // Calculate chargeable units: how many of the newly added units exceed the limit
    const previousUsed = newUsed - units;
    const freeRemaining = Math.max(0, limit - previousUsed);
    const chargeableUnits = units - freeRemaining;
    if (chargeableUnits <= 0) {
      return { charged: false, amount: 0, withinFreeTier: true };
    }

    const chargeAmount = chargeableUnits * RATE_PER_UNIT;

    // Atomic balance decrement in same transaction
    const charged = await tx.wallet.update({
      where: { tenantId },
      data: { balance: { decrement: chargeAmount } },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: charged.id,
        type: usageType === "sms" ? "SMS_CHARGE" : "CALL_CHARGE",
        amount: -chargeAmount,
        balance: charged.balance,
        description:
          usageType === "sms"
            ? `SMS charge (${chargeableUnits} message${chargeableUnits > 1 ? "s" : ""})`
            : `Call charge (${chargeableUnits} minute${chargeableUnits > 1 ? "s" : ""})`,
      },
    });

    return { charged: true, amount: chargeAmount, withinFreeTier: false };
  });

  // Check if auto-recharge is needed (fire and forget)
  if (result.charged) {
    checkAndAutoRecharge(tenantId).catch((err) =>
      console.error("Auto-recharge check failed:", err)
    );
  }

  return result;
}

/**
 * Check balance and trigger auto-recharge if below threshold.
 * Uses a `recharging` flag to prevent concurrent recharges for the same tenant.
 */
export async function checkAndAutoRecharge(tenantId: string): Promise<boolean> {
  // Atomically claim the recharge lock — only one process can recharge at a time
  const { count } = await prisma.wallet.updateMany({
    where: {
      tenantId,
      autoRecharge: true,
      recharging: false,
    },
    data: { recharging: true },
  });

  // Another process is already recharging, or auto-recharge is off
  if (count === 0) return false;

  try {
    const wallet = await prisma.wallet.findUnique({ where: { tenantId } });
    if (!wallet) return false;

    const balance = Number(wallet.balance);
    const threshold = Number(wallet.rechargeThreshold);
    const rechargeAmount = Number(wallet.rechargeAmount);

    if (balance >= threshold) return false;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) return false;

    const customer = await stripe.customers.retrieve(tenant.stripeCustomerId);
    if (customer.deleted) return false;

    let paymentMethodId =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id;

    if (!paymentMethodId) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: tenant.stripeCustomerId,
        type: "card",
        limit: 1,
      });
      if (paymentMethods.data.length === 0) return false;
      paymentMethodId = paymentMethods.data[0].id;
    }

    return await chargeAndAddFunds(tenantId, tenant.stripeCustomerId, paymentMethodId, rechargeAmount);
  } catch (error) {
    console.error("Auto-recharge error:", error);
    return false;
  } finally {
    // Always release the lock
    await prisma.wallet.update({
      where: { tenantId },
      data: { recharging: false },
    }).catch(() => {});
  }
}

/**
 * Charge via Stripe and add funds to wallet.
 * Charges subtotal + HST + Stripe fee; only credits the subtotal to the wallet.
 */
async function chargeAndAddFunds(
  tenantId: string,
  customerId: string,
  paymentMethodId: string,
  amount: number
): Promise<boolean> {
  const { subtotal, tax, stripeFee, total } = calculateTotalWithFees(amount);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100),
    currency: "cad",
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    description: `Measy Wallet Auto-Recharge - $${subtotal.toFixed(2)} + HST $${tax.toFixed(2)} + fee $${stripeFee.toFixed(2)} = $${total.toFixed(2)} CAD`,
    metadata: {
      tenantId,
      type: "wallet_recharge",
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      stripeFee: stripeFee.toFixed(2),
    },
  });

  if (paymentIntent.status === "succeeded") {
    await addFunds(
      tenantId,
      subtotal,
      "RECHARGE",
      `Auto-recharge $${subtotal.toFixed(2)} CAD (charged $${total.toFixed(2)} incl. HST + fee)`,
      paymentIntent.id
    );
    return true;
  }

  console.error(`Auto-recharge payment intent status: ${paymentIntent.status}`);
  return false;
}

export { RATE_PER_UNIT };
