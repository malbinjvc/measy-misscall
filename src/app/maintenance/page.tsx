"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Phone, Wrench, Loader2 } from "lucide-react";

function MaintenanceContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("from") || "/";

  // Poll every 30 seconds — when maintenance ends, redirect back to original page
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/internal/maintenance");
        const json = await res.json();
        if (!json.enabled) {
          window.location.href = returnTo;
        }
      } catch {
        // ignore fetch errors
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [returnTo]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Phone className="h-12 w-12 text-primary" />
            <Wrench className="h-6 w-6 text-amber-500 absolute -bottom-1 -right-1" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-3">We&apos;ll Be Right Back</h1>
        <p className="text-muted-foreground mb-6">
          We&apos;re performing scheduled maintenance to improve our service.
          This page will automatically refresh when we&apos;re back online.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking status...
        </div>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <MaintenanceContent />
    </Suspense>
  );
}
