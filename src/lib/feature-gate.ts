import prismaRead from "./prisma-read";

/**
 * Feature keys that can be gated per plan.
 * Stored in Plan.features string array.
 */
export type FeatureKey =
  | "missed_call_ivr"    // IVR system + SMS auto-reply after missed call
  | "appointment_sms"    // Confirmation + reminder SMS
  | "auto_confirm"       // Auto-confirm appointments
  | "campaigns"          // SMS blast campaigns
  | "review_import"      // Bulk review import from CSV/Excel
  | "custom_domain"      // White-label shop on tenant's domain
  | "ai_chat"            // AI chatbot on shop storefront
  | "custom_dev";        // Custom software development (Enterprise)

/**
 * Check if a tenant has access to a specific feature.
 * Queries subscription → plan → features array.
 *
 * Returns true if:
 * - The plan's features array includes the featureKey, OR
 * - The tenant has no subscription (free/legacy — deny by default)
 *
 * Uses read replica for performance.
 */
export async function hasFeature(
  tenantId: string,
  featureKey: FeatureKey
): Promise<boolean> {
  const subscription = await prismaRead.subscription.findUnique({
    where: { tenantId },
    select: { plan: { select: { features: true } } },
  });

  if (!subscription?.plan) return false;
  return subscription.plan.features.includes(featureKey);
}

/**
 * Get all features for a tenant in one query.
 * Useful when checking multiple features at once (e.g., sidebar rendering).
 */
export async function getTenantFeatures(
  tenantId: string
): Promise<string[]> {
  const subscription = await prismaRead.subscription.findUnique({
    where: { tenantId },
    select: { plan: { select: { features: true } } },
  });

  return subscription?.plan?.features ?? [];
}

/**
 * Build a 403 response for gated features with upgrade message.
 */
export function featureGatedResponse(featureName: string) {
  return {
    success: false,
    error: `${featureName} is not available on your current plan. Please upgrade to access this feature.`,
    code: "FEATURE_GATED",
  };
}
