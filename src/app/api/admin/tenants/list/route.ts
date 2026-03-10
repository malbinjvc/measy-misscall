import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

/**
 * Lightweight endpoint returning all tenant id+name pairs for dropdowns.
 * Only selects 2 columns — safe even with 10K tenants (~200KB response).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const tenants = await prisma.tenant.findMany({
      where: { status: { in: ["ACTIVE", "ONBOARDING"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: tenants });
  } catch (error) {
    console.error("Tenant list fetch error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}
