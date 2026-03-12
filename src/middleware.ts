import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

// In-memory caches (Edge-compatible — no Prisma in middleware)
const domainCache = new Map<string, { slug: string; expiresAt: number } | null>();
const CACHE_TTL_MS = 120_000; // 2 minutes

let maintenanceCache: { enabled: boolean; expiresAt: number } | null = null;
const MAINTENANCE_CACHE_TTL = 5_000; // 5 seconds — short TTL so toggling off takes effect quickly

function getInternalUrl(req: NextRequest): string {
  // Always use the request's own origin for internal API calls (not NEXT_PUBLIC_APP_URL which may be ngrok/external)
  return req.nextUrl.origin;
}

async function checkMaintenanceMode(req: NextRequest): Promise<boolean> {
  if (maintenanceCache && Date.now() < maintenanceCache.expiresAt) {
    return maintenanceCache.enabled;
  }
  try {
    const res = await fetch(`${getInternalUrl(req)}/api/internal/maintenance`);
    const json = await res.json();
    const enabled = json.enabled ?? false;
    maintenanceCache = { enabled, expiresAt: Date.now() + MAINTENANCE_CACHE_TTL };
    return enabled;
  } catch {
    return false;
  }
}

async function resolveDomain(req: NextRequest, hostname: string): Promise<{ slug: string } | null> {
  const cached = domainCache.get(hostname);
  if (cached !== undefined) {
    if (cached === null) return null;
    if (Date.now() < cached.expiresAt) return cached;
  }

  try {
    const res = await fetch(`${getInternalUrl(req)}/api/internal/resolve-domain?hostname=${encodeURIComponent(hostname)}`);
    const json = await res.json();
    if (json.slug) {
      const entry = { slug: json.slug, expiresAt: Date.now() + CACHE_TTL_MS };
      domainCache.set(hostname, entry);
      return entry;
    }
  } catch { /* ignore */ }

  domainCache.set(hostname, null);
  return null;
}

function getMainHostname(): string {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname;
}

function isMainDomain(hostname: string): boolean {
  const main = getMainHostname();
  return hostname === main || hostname === "localhost" || hostname.startsWith("localhost:");
}

// Custom domain path -> /shop/[slug] path mapping
const CUSTOM_DOMAIN_ROUTES: Record<string, (slug: string) => string> = {
  "/": (slug) => `/shop/${slug}`,
  "/book": (slug) => `/shop/${slug}/book`,
  "/book/confirmation": (slug) => `/shop/${slug}/book/confirmation`,
  "/account": (slug) => `/shop/${slug}/account`,
  "/reviews": (slug) => `/shop/${slug}/reviews`,
};

async function handleCustomDomain(req: NextRequest): Promise<NextResponse | null> {
  const hostname = (req.headers.get("host") || "").split(":")[0];

  if (isMainDomain(hostname)) return null; // not a custom domain

  const resolved = await resolveDomain(req, hostname);
  if (!resolved) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const pathname = req.nextUrl.pathname;

  // Static assets pass through
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // API calls from shop pages already include /api/public/shop/[slug] — pass through
  if (pathname.startsWith("/api/public/shop/") || pathname.startsWith("/api/twilio")) {
    return NextResponse.next();
  }

  // Block dashboard/admin/login access from custom domains
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL(pathname, process.env.NEXT_PUBLIC_APP_URL));
  }

  // Rewrite known shop routes
  const rewriter = CUSTOM_DOMAIN_ROUTES[pathname];
  if (rewriter) {
    const url = req.nextUrl.clone();
    url.pathname = rewriter(resolved.slug);
    const response = NextResponse.rewrite(url);
    response.headers.set("x-custom-domain", hostname);
    response.headers.set("x-custom-domain-slug", resolved.slug);
    return response;
  }

  // Public uploads pass through
  if (pathname.startsWith("/uploads")) {
    return NextResponse.next();
  }

  return new NextResponse("Not Found", { status: 404 });
}

// Main domain auth middleware (existing logic wrapped in withAuth)
const authMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Super admin routes
    if (pathname.startsWith("/admin")) {
      if (token?.role !== "SUPER_ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    // Dashboard routes
    if (pathname.startsWith("/dashboard")) {
      // Super admins go to admin dashboard (unless impersonating a tenant)
      if (token?.role === "SUPER_ADMIN" && !token?.isImpersonating) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }

      // Force onboarding tenants to wizard
      if (
        token?.tenantStatus === "ONBOARDING" &&
        !pathname.startsWith("/dashboard/onboarding")
      ) {
        return NextResponse.redirect(
          new URL("/dashboard/onboarding", req.url)
        );
      }

      // Block suspended or disabled tenants
      if (
        token?.tenantStatus === "SUSPENDED" ||
        token?.tenantStatus === "DISABLED"
      ) {
        return NextResponse.redirect(
          new URL("/suspended", req.url)
        );
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Public routes - no auth needed
        if (
          pathname === "/" ||
          pathname.startsWith("/shop") ||
          pathname.startsWith("/api/twilio") ||
          pathname.startsWith("/api/stripe/webhook") ||
          pathname.startsWith("/api/public") ||
          pathname.startsWith("/uploads") ||
          pathname.startsWith("/suspended") ||
          pathname.startsWith("/maintenance") ||
          pathname.startsWith("/api/cron") ||
          pathname.startsWith("/api/internal") ||
          pathname === "/api/health"
        ) {
          return true;
        }

        // Auth routes - accessible without login
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/forgot-password") ||
          pathname.startsWith("/accept-invite")
        ) {
          return true;
        }

        // All other routes need auth
        return !!token;
      },
    },
  }
);

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Skip for static assets and internal API (prevent infinite loops)
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.startsWith("/api/internal") || pathname === "/api/health") {
    return NextResponse.next();
  }

  // Check custom domain first — before auth
  const customDomainResponse = await handleCustomDomain(req);
  if (customDomainResponse) {
    // For custom domains, check maintenance before serving shop pages
    const isMaintenance = await checkMaintenanceMode(req);
    if (isMaintenance && customDomainResponse.status !== 404) {
      const url = req.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.rewrite(url);
    }
    return customDomainResponse;
  }

  // Maintenance mode: block public-facing routes (shop pages, public APIs, Twilio webhooks)
  // Admin, dashboard, auth, and internal routes are NOT blocked
  if (
    pathname.startsWith("/shop") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/twilio")
  ) {
    const isMaintenance = await checkMaintenanceMode(req);
    if (isMaintenance) {
      // For API/webhook routes, return 503 JSON
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { success: false, error: "Service temporarily unavailable for maintenance" },
          { status: 503 }
        );
      }
      // For shop pages, redirect to maintenance page with return URL (302 + no-cache)
      const maintenanceUrl = new URL("/maintenance", req.url);
      maintenanceUrl.searchParams.set("from", pathname);
      const response = NextResponse.redirect(maintenanceUrl, 302);
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      return response;
    }
  }

  // Main domain: delegate to NextAuth middleware
  return (authMiddleware as (req: NextRequest) => Promise<NextResponse>)(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
