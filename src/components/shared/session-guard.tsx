"use client";

import { useSession } from "next-auth/react";
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
    (role: string | undefined) => {
      if (redirecting.current || !role) return;

      let redirectTo = "";

      if (requiredRole === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
        redirectTo = role === "SUPER_ADMIN" ? "/admin" : "/dashboard";
      } else if (requiredRole === "TENANT" && role === "SUPER_ADMIN") {
        redirectTo = "/admin";
      }

      if (redirectTo) {
        redirecting.current = true;
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

    checkAndRedirect(session.user.role);
  }, [session, status, checkAndRedirect, router, pathname]);

  // On window/tab focus: directly fetch fresh session and check role
  useEffect(() => {
    const handleFocus = async () => {
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

        checkAndRedirect(freshRole);

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

  // Don't render children if wrong role
  if (session?.user) {
    const currentRole = session.user.role;
    if (requiredRole === "SUPER_ADMIN" && currentRole !== "SUPER_ADMIN") return null;
    if (requiredRole === "TENANT" && currentRole === "SUPER_ADMIN") return null;
  }

  return <>{children}</>;
}
