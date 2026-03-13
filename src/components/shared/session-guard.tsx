"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useCallback } from "react";

export function SessionGuard({
  requiredRole,
  children,
}: {
  requiredRole: "SUPER_ADMIN" | "TENANT";
  children: React.ReactNode;
}) {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const redirecting = useRef(false);
  const hasRendered = useRef(false);

  const checkAndRedirect = useCallback(
    (role: string | undefined, isImpersonating?: boolean, tenantStatus?: string | null) => {
      if (redirecting.current || !role) return;

      let redirectTo = "";

      if (requiredRole === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
        redirectTo = role === "SUPER_ADMIN" ? "/admin" : "/dashboard";
      } else if (requiredRole === "TENANT" && role === "SUPER_ADMIN" && !isImpersonating) {
        redirectTo = "/admin";
      }

      // Immediately enforce suspended/disabled status for tenant routes
      if (requiredRole === "TENANT" && role !== "SUPER_ADMIN") {
        if (tenantStatus === "SUSPENDED" || tenantStatus === "DISABLED") {
          redirectTo = "/suspended";
        }
      }

      if (redirectTo) {
        redirecting.current = true;
        // For disabled tenants with no tenantId (deleted), sign out entirely
        if (tenantStatus === "DISABLED" && !redirectTo.startsWith("/suspended")) {
          signOut({ callbackUrl: "/login" });
          return;
        }
        router.replace(redirectTo);
      }
    },
    [requiredRole, router]
  );

  // Check role on session changes
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      if (!redirecting.current) {
        redirecting.current = true;
        router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      }
      return;
    }

    // Tenant was deleted — user record is gone, force sign out
    if (
      requiredRole === "TENANT" &&
      session.user.role !== "SUPER_ADMIN" &&
      !session.user.tenantId &&
      session.user.tenantStatus === "DISABLED"
    ) {
      if (!redirecting.current) {
        redirecting.current = true;
        signOut({ callbackUrl: "/login" });
      }
      return;
    }

    checkAndRedirect(session.user.role, session.user.isImpersonating, session.user.tenantStatus);
  }, [session, status, checkAndRedirect, router, pathname, requiredRole]);

  // On window/tab focus: directly fetch fresh session and check role
  // Debounced to avoid redundant fetches when both focus + visibilitychange fire
  const lastFocusCheck = useRef(0);
  useEffect(() => {
    const DEBOUNCE_MS = 5000; // at most one check every 5 seconds

    const handleFocus = async () => {
      const now = Date.now();
      if (now - lastFocusCheck.current < DEBOUNCE_MS) return;
      lastFocusCheck.current = now;

      try {
        // Fetch session directly from the API — bypasses any stale cache
        const res = await fetch("/api/auth/session");
        const freshSession = await res.json();
        const freshRole = freshSession?.user?.role;

        if (!freshRole) {
          // Session gone — user was signed out
          if (!redirecting.current) {
            redirecting.current = true;
            router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
          }
          return;
        }

        checkAndRedirect(freshRole, freshSession?.user?.isImpersonating, freshSession?.user?.tenantStatus);

        // Also update the SessionProvider's cached session
        update();
      } catch {
        // Network error — ignore
      }
    };

    window.addEventListener("focus", handleFocus);
    // Also listen to visibilitychange for tab switches
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkAndRedirect, router, pathname, update]);

  // Only show blank on initial load — never unmount children during
  // background session refreshes (focus/visibility events) to avoid
  // wiping in-progress form state.
  if (status === "loading" && !hasRendered.current) return null;
  if (status !== "loading") hasRendered.current = true;

  // Don't render children if wrong role or tenant is suspended/disabled
  if (session?.user) {
    const { role: currentRole, tenantStatus, isImpersonating } = session.user;
    if (requiredRole === "SUPER_ADMIN" && currentRole !== "SUPER_ADMIN") return null;
    if (requiredRole === "TENANT" && currentRole === "SUPER_ADMIN" && !isImpersonating) return null;
    if (requiredRole === "TENANT" && currentRole !== "SUPER_ADMIN" && (tenantStatus === "SUSPENDED" || tenantStatus === "DISABLED")) return null;
  }

  return <>{children}</>;
}
