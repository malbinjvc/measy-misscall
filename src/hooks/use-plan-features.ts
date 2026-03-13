import { useQuery } from "@tanstack/react-query";

interface PlanData {
  features: string[];
  maxStaff: number;
  maxCalls: number;
  maxSms: number;
  name: string;
}

/**
 * Fetch the current tenant's plan features.
 * Uses ["tenant"] query key to share cache with sidebar/header prefetches
 * that hit the same /api/tenant endpoint — avoids duplicate requests.
 */
export function usePlanFeatures() {
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) return null;
      const json = await res.json();
      return json.success ? json.data : null;
    },
    staleTime: 300000, // 5 min — plan changes are rare
  });

  const plan: PlanData | null = tenantData?.subscription?.plan
    ? {
        features: tenantData.subscription.plan.features ?? [],
        maxStaff: tenantData.subscription.plan.maxStaff ?? 1,
        maxCalls: tenantData.subscription.plan.maxCalls ?? 0,
        maxSms: tenantData.subscription.plan.maxSms ?? 0,
        name: tenantData.subscription.plan.name ?? "",
      }
    : null;

  const features = plan?.features ?? [];

  return {
    features,
    plan,
    isLoading,
    hasFeature: (key: string) => features.includes(key),
  };
}
