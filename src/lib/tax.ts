/**
 * Tax calculation for Canadian business registered in Ottawa, Ontario.
 * HST (Harmonized Sales Tax) = 13% (5% GST + 8% Ontario PST).
 */

export const HST_RATE = 0.13;
export const HST_LABEL = "HST (ON)";
export const MONTHLY_PREMIUM = 30; // +$30 CAD for monthly billing vs annual

/** Round to 2 decimal places (cents) */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calculate HST on a subtotal.
 */
export function calculateTax(subtotal: number) {
  const tax = round2(subtotal * HST_RATE);
  const total = round2(subtotal + tax);
  return { subtotal, tax, total, rate: HST_RATE, label: HST_LABEL };
}

/**
 * Stripe processing fee: 2.9% + $0.30 CAD per transaction.
 * Pass-through to tenant on wallet charges.
 */
export const STRIPE_FEE_PERCENT = 0.029;
export const STRIPE_FEE_FIXED = 0.30;

/**
 * Calculate total with HST + Stripe processing fee.
 * Used for wallet recharges where tenant pays all fees.
 */
export function calculateTotalWithFees(subtotal: number) {
  const tax = round2(subtotal * HST_RATE);
  const subtotalWithTax = subtotal + tax;
  const stripeFee = round2(subtotalWithTax * STRIPE_FEE_PERCENT + STRIPE_FEE_FIXED);
  const total = round2(subtotalWithTax + stripeFee);
  return { subtotal, tax, stripeFee, total, rate: HST_RATE, label: HST_LABEL };
}

/**
 * Get the monthly price for a plan (annual price + monthly premium).
 */
export function getMonthlyPrice(annualMonthlyEquivalent: number): number {
  return round2(annualMonthlyEquivalent + MONTHLY_PREMIUM);
}
