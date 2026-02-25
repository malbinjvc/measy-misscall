"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";

interface TenantContext {
  tenant: any | null;
  isLoading: boolean;
  error: any;
  refetch: () => void;
}

const TenantContext = createContext<TenantContext>({
  tenant: null,
  isLoading: true,
  error: null,
  refetch: () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenant", session?.user?.tenantId],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) throw new Error("Failed to fetch tenant");
      const json = await res.json();
      return json.data;
    },
    enabled: !!session?.user?.tenantId,
  });

  return (
    <TenantContext.Provider
      value={{ tenant: data ?? null, isLoading, error, refetch }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
