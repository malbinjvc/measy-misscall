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
 * Shares the same query key as the tenant data prefetch in sidebar,
 * so this is often a cache hit (no extra request).
 */
export function usePlanFeatures() {
  const { data, isLoading } = useQuery<PlanData | null>({
    queryKey: ["plan-features"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) return null;
      const json = await res.json();
      if (!json.success) return null;
      const plan = json.data?.subscription?.plan;
      return plan
        ? {
            features: plan.features ?? [],
            maxStaff: plan.maxStaff ?? 1,
            maxCalls: plan.maxCalls ?? 0,
            maxSms: plan.maxSms ?? 0,
            name: plan.name ?? "",
          }
        : null;
    },
    staleTime: 300000, // 5 min — plan changes are rare
  });

  const features = data?.features ?? [];

  return {
    features,
    plan: data,
    isLoading,
    hasFeature: (key: string) => features.includes(key),
  };
}
