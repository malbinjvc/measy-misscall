import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCustomerPortalSession } from "@/lib/stripe";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
    });

    if (!tenant?.stripeCustomerId) {
      return NextResponse.json({ success: false, error: "No billing account" }, { status: 400 });
    }

    const portalSession = await createCustomerPortalSession(
      tenant.stripeCustomerId,
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`
    );

    return NextResponse.json({ success: true, data: { url: portalSession.url } });
  } catch (error: any) {
    console.error("Portal error:", error);
    return NextResponse.json({ success: false, error: "Failed to create portal session" }, { status: 500 });
  }
}
