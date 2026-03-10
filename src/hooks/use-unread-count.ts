import { useQuery } from "@tanstack/react-query";

export function useUnreadCount() {
  return useQuery<number>({
    queryKey: ["support-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/support/tickets/unread-count");
      const json = await res.json();
      return json.count ?? 0;
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
