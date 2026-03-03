import { NextRequest, NextResponse } from "next/server";

/**
 * CSRF protection via Origin header verification.
 * Returns an error response if the Origin doesn't match, or null if safe.
 */
export function verifyCsrf(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");

  // Same-origin requests (e.g. server-side calls) may omit Origin — allow
  if (!origin) return null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !origin.startsWith(appUrl)) {
    return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
  }

  return null;
}
