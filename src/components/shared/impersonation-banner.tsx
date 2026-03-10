"use client";

import { useSession } from "next-auth/react";
import { useTenant } from "@/providers/tenant-provider";
import { useState } from "react";
import { Eye, X } from "lucide-react";

export function ImpersonationBanner() {
  const { data: session } = useSession();
  const { tenant } = useTenant();
  const [exiting, setExiting] = useState(false);

  if (!session?.user?.isImpersonating) return null;

  async function handleExit() {
    setExiting(true);
    try {
      await fetch("/api/admin/impersonate", { method: "DELETE" });
      // Force session refresh so JWT cookie clears impersonation before navigation
      await fetch("/api/auth/session");
      window.location.href = "/admin/tenants";
    } catch {
      setExiting(false);
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <Eye className="h-4 w-4" />
      <span>
        Viewing as: <strong>{tenant?.name ?? "..."}</strong> (Admin Mode)
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
      >
        <X className="h-3 w-3" />
        {exiting ? "Exiting..." : "Exit"}
      </button>
    </div>
  );
}
