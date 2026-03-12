import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Lightweight endpoint for middleware to resolve custom domains
// No auth required — only returns a slug, no sensitive data
export async function GET(req: NextRequest) {
  try {
    const hostname = req.nextUrl.searchParams.get("hostname");
    if (!hostname) {
      return NextResponse.json({ slug: null });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { customDomain: hostname, customDomainVerified: true, status: "ACTIVE" },
      select: { slug: true },
    });

    return NextResponse.json({ slug: tenant?.slug ?? null });
  } catch {
    return NextResponse.json({ slug: null });
  }
}
