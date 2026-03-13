/**
 * Shared prefetch configuration for sidebar + header mobile nav.
 * Ensures both use the same query keys + response parsing logic.
 */

export interface PrefetchConfig {
  queryKey: unknown[];
  url: string;
  /** If true, parse response as { success, data } and return data. Otherwise return raw JSON. */
  extractData?: boolean;
}

export const PREFETCH_ROUTES: Record<string, PrefetchConfig> = {
  "/dashboard/wallet": { queryKey: ["wallet", "1"], url: "/api/wallet?page=1&limit=15", extractData: true },
  "/dashboard/appointments": { queryKey: ["appointments", 1, null], url: "/api/appointments?page=1&pageSize=20" },
  "/dashboard/customers": { queryKey: ["customers", 1, ""], url: "/api/customers?page=1&pageSize=20" },
  "/dashboard/calls": { queryKey: ["calls", 1, "", ""], url: "/api/calls?page=1&pageSize=20" },
  "/dashboard/sms-logs": { queryKey: ["sms-logs", 1, ""], url: "/api/sms?page=1&pageSize=20" },
  "/dashboard/services": { queryKey: ["services"], url: "/api/services" },
  "/dashboard/campaigns": { queryKey: ["campaigns", 1], url: "/api/campaigns?page=1&pageSize=20" },
  "/dashboard/staff": { queryKey: ["staff"], url: "/api/staff" },
  "/dashboard/billing": { queryKey: ["tenant"], url: "/api/tenant", extractData: true },
  "/dashboard/website": { queryKey: ["tenant"], url: "/api/tenant", extractData: true },
  "/dashboard/settings": { queryKey: ["tenant"], url: "/api/tenant", extractData: true },
};

export function prefetchRoute(
  queryClient: { prefetchQuery: (opts: { queryKey: unknown[]; queryFn: () => Promise<unknown>; staleTime: number }) => void },
  href: string,
) {
  const config = PREFETCH_ROUTES[href];
  if (!config) return;

  queryClient.prefetchQuery({
    queryKey: config.queryKey,
    queryFn: async () => {
      const res = await fetch(config.url);
      if (!res.ok) return null;
      const json = await res.json();
      return config.extractData ? (json.success ? json.data : null) : json;
    },
    staleTime: 60000,
  });
}
