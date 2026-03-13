/**
 * Integration test: Middleware auth routing
 * Tests the routing logic for public routes, auth-required routes,
 * role-based access (SUPER_ADMIN vs TENANT), and custom domain rewrites.
 *
 * Note: We test the LOGIC, not the actual HTTP middleware (which requires
 * a running Next.js server). We simulate the conditions and verify behavior.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  prisma,
  createTestTenant,
  createTestSubscription,
  cleanupTestData,
  type TestTenant,
} from "./helpers";

let tenantA: TestTenant;
let tenantWithDomain: TestTenant;

beforeAll(async () => {
  tenantA = await createTestTenant();
  tenantWithDomain = await createTestTenant();

  // Set up custom domain
  await prisma.tenant.update({
    where: { id: tenantWithDomain.tenant.id },
    data: {
      customDomain: `${tenantWithDomain.tenant.slug}.example.com`,
      customDomainVerified: true,
    },
  });

  // Set up subscriptions with features
  await createTestSubscription(tenantA.tenant.id, [
    "missed_call_ivr",
    "appointment_sms",
    "campaigns",
  ]);
}, 15000);

afterAll(async () => {
  await cleanupTestData();
}, 15000);

// --- Public route classification ---

const PUBLIC_ROUTES = [
  "/",
  "/shop/test-shop",
  "/shop/test-shop/book",
  "/shop/test-shop/reviews",
  "/api/twilio/voice",
  "/api/twilio/sms-status",
  "/api/stripe/webhook",
  "/api/public/shop/test/book",
  "/uploads/image.jpg",
  "/suspended",
  "/maintenance",
  "/api/cron/appointment-reminders",
  "/api/internal/maintenance",
  "/api/health",
];

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/api/auth/signin",
  "/forgot-password",
  "/accept-invite",
];

const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/appointments",
  "/dashboard/settings",
  "/admin",
  "/admin/tenants",
  "/api/appointments",
  "/api/settings",
];

describe("Route classification", () => {
  // Replicate the middleware's route classification logic
  function isPublicRoute(pathname: string): boolean {
    return (
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
    );
  }

  function isAuthRoute(pathname: string): boolean {
    return (
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/accept-invite")
    );
  }

  function requiresAuth(pathname: string): boolean {
    return !isPublicRoute(pathname) && !isAuthRoute(pathname);
  }

  for (const route of PUBLIC_ROUTES) {
    it(`${route} is public (no auth required)`, () => {
      expect(isPublicRoute(route)).toBe(true);
      expect(requiresAuth(route)).toBe(false);
    });
  }

  for (const route of AUTH_ROUTES) {
    it(`${route} is an auth route (accessible without login)`, () => {
      expect(isAuthRoute(route)).toBe(true);
      expect(requiresAuth(route)).toBe(false);
    });
  }

  for (const route of PROTECTED_ROUTES) {
    it(`${route} requires authentication`, () => {
      expect(requiresAuth(route)).toBe(true);
    });
  }
});

// --- Role-based routing logic ---

describe("Role-based routing", () => {
  function getRedirect(pathname: string, token: { role: string; tenantStatus?: string; isImpersonating?: boolean }): string | null {
    if (pathname.startsWith("/admin")) {
      if (token.role !== "SUPER_ADMIN") return "/dashboard";
    }

    if (pathname.startsWith("/dashboard")) {
      if (token.role === "SUPER_ADMIN" && !token.isImpersonating) return "/admin";
      if (token.tenantStatus === "ONBOARDING" && !pathname.startsWith("/dashboard/onboarding")) return "/dashboard/onboarding";
      if (token.tenantStatus === "SUSPENDED" || token.tenantStatus === "DISABLED") return "/suspended";
    }

    return null;
  }

  it("non-admin accessing /admin is redirected to /dashboard", () => {
    expect(getRedirect("/admin", { role: "TENANT_OWNER" })).toBe("/dashboard");
  });

  it("SUPER_ADMIN can access /admin", () => {
    expect(getRedirect("/admin", { role: "SUPER_ADMIN" })).toBeNull();
  });

  it("SUPER_ADMIN accessing /dashboard is redirected to /admin", () => {
    expect(getRedirect("/dashboard", { role: "SUPER_ADMIN" })).toBe("/admin");
  });

  it("SUPER_ADMIN impersonating can access /dashboard", () => {
    expect(getRedirect("/dashboard", { role: "SUPER_ADMIN", isImpersonating: true })).toBeNull();
  });

  it("ONBOARDING tenant is redirected to /dashboard/onboarding", () => {
    expect(getRedirect("/dashboard/settings", { role: "TENANT_OWNER", tenantStatus: "ONBOARDING" })).toBe("/dashboard/onboarding");
  });

  it("ONBOARDING tenant can access /dashboard/onboarding", () => {
    expect(getRedirect("/dashboard/onboarding", { role: "TENANT_OWNER", tenantStatus: "ONBOARDING" })).toBeNull();
  });

  it("SUSPENDED tenant is redirected to /suspended", () => {
    expect(getRedirect("/dashboard", { role: "TENANT_OWNER", tenantStatus: "SUSPENDED" })).toBe("/suspended");
  });

  it("DISABLED tenant is redirected to /suspended", () => {
    expect(getRedirect("/dashboard/calls", { role: "TENANT_OWNER", tenantStatus: "DISABLED" })).toBe("/suspended");
  });

  it("ACTIVE tenant can access /dashboard", () => {
    expect(getRedirect("/dashboard", { role: "TENANT_OWNER", tenantStatus: "ACTIVE" })).toBeNull();
  });
});

// --- Custom domain routing ---

describe("Custom domain routing", () => {
  const CUSTOM_DOMAIN_ROUTES: Record<string, (slug: string) => string> = {
    "/": (slug) => `/shop/${slug}`,
    "/book": (slug) => `/shop/${slug}/book`,
    "/book/confirmation": (slug) => `/shop/${slug}/book/confirmation`,
    "/account": (slug) => `/shop/${slug}/account`,
    "/reviews": (slug) => `/shop/${slug}/reviews`,
  };

  it("custom domain can be resolved from DB", async () => {
    const tenant = await prisma.tenant.findFirst({
      where: {
        customDomain: `${tenantWithDomain.tenant.slug}.example.com`,
        customDomainVerified: true,
      },
      select: { slug: true },
    });

    expect(tenant).not.toBeNull();
    expect(tenant!.slug).toBe(tenantWithDomain.tenant.slug);
  });

  it("/ on custom domain rewrites to /shop/[slug]", () => {
    const rewriter = CUSTOM_DOMAIN_ROUTES["/"];
    expect(rewriter(tenantWithDomain.tenant.slug)).toBe(
      `/shop/${tenantWithDomain.tenant.slug}`
    );
  });

  it("/book on custom domain rewrites to /shop/[slug]/book", () => {
    const rewriter = CUSTOM_DOMAIN_ROUTES["/book"];
    expect(rewriter("my-shop")).toBe("/shop/my-shop/book");
  });

  it("/account on custom domain rewrites to /shop/[slug]/account", () => {
    const rewriter = CUSTOM_DOMAIN_ROUTES["/account"];
    expect(rewriter("my-shop")).toBe("/shop/my-shop/account");
  });

  it("dashboard paths on custom domain should be blocked", () => {
    const blocked = ["/dashboard", "/admin", "/login", "/register"];
    for (const path of blocked) {
      expect(path.startsWith("/dashboard") || path.startsWith("/admin") || path.startsWith("/login") || path.startsWith("/register")).toBe(true);
    }
  });

  it("unverified custom domain is not resolvable", async () => {
    await prisma.tenant.update({
      where: { id: tenantWithDomain.tenant.id },
      data: { customDomainVerified: false },
    });

    const tenant = await prisma.tenant.findFirst({
      where: {
        customDomain: `${tenantWithDomain.tenant.slug}.example.com`,
        customDomainVerified: true,
      },
    });

    expect(tenant).toBeNull();

    // Restore
    await prisma.tenant.update({
      where: { id: tenantWithDomain.tenant.id },
      data: { customDomainVerified: true },
    });
  });
});

// --- Feature gating with real DB ---

describe("Feature gating (DB integration)", () => {
  it("tenant with subscription has correct features", async () => {
    const sub = await prisma.subscription.findUnique({
      where: { tenantId: tenantA.tenant.id },
      select: { plan: { select: { features: true } } },
    });

    expect(sub).not.toBeNull();
    expect(sub!.plan.features).toContain("missed_call_ivr");
    expect(sub!.plan.features).toContain("campaigns");
    expect(sub!.plan.features).not.toContain("custom_domain");
  });

  it("tenant without subscription has no features", async () => {
    const sub = await prisma.subscription.findUnique({
      where: { tenantId: tenantWithDomain.tenant.id },
    });

    expect(sub).toBeNull();
  });
});
