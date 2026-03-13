"use client";

import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingPage } from "@/components/shared/loading";

// Lazy-load WebsiteBuilder — heavy component (TipTap, DnD, color pickers)
const WebsiteBuilder = dynamic(
  () => import("@/components/website-builder").then((m) => m.WebsiteBuilder),
  { loading: () => <LoadingPage /> }
);

export default function WebsitePage() {
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) throw new Error("Request failed");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant"] }),
  });

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader
        title="Website Builder"
        description="Design and customize your public shop page"
      />
      <WebsiteBuilder tenant={tenant} mutation={updateMutation} />
    </div>
  );
}
