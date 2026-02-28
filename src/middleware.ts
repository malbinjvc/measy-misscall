import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
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
      // Super admins go to admin dashboard
      if (token?.role === "SUPER_ADMIN") {
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

      // Block suspended tenants
      if (token?.tenantStatus === "SUSPENDED") {
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
          pathname.startsWith("/uploads/ivr") ||
          pathname.startsWith("/suspended")
        ) {
          return true;
        }

        // Auth routes - accessible without login
        if (
          pathname.startsWith("/login") ||
          pathname.startsWith("/register") ||
          pathname.startsWith("/api/auth")
        ) {
          return true;
        }

        // All other routes need auth
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
