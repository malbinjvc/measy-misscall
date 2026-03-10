import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// In-memory cache: hostname -> { slug } | null
const domainCache = new Map<string, { slug: string; expiresAt: number } | null>();
const CACHE_TTL_MS = 120_000; // 2 minutes

async function resolveDomain(hostname: string): Promise<{ slug: string } | null> {
  const cached = domainCache.get(hostname);
  if (cached !== undefined) {
    if (cached === null) return null;
    if (Date.now() < cached.expiresAt) return cached;
  }

  const tenant = await prisma.tenant.findFirst({
    where: { customDomain: hostname, customDomainVerified: true, status: "ACTIVE" },
    select: { slug: true },
  });

  if (tenant) {
    const entry = { slug: tenant.slug, expiresAt: Date.now() + CACHE_TTL_MS };
    domainCache.set(hostname, entry);
    return entry;
  }

  domainCache.set(hostname, null); // negative cache
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

  const resolved = await resolveDomain(hostname);
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
          pathname.startsWith("/api/cron")
        ) {
          return true;
        }

        // Auth routes - accessible without login
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/forgot-password")
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
  // Check custom domain first — before auth
  const customDomainResponse = await handleCustomDomain(req);
  if (customDomainResponse) return customDomainResponse;

  // Main domain: delegate to NextAuth middleware
  return (authMiddleware as (req: NextRequest) => Promise<NextResponse>)(req);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
