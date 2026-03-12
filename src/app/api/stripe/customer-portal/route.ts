import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createCustomerPortalSession } from "@/lib/stripe";

export async function POST(req: NextRequest) {
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

    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/[^/]*$/, "") || process.env.NEXT_PUBLIC_APP_URL;
    const baseUrl = origin?.replace(/\/$/, "") || "";

    const portalSession = await createCustomerPortalSession(
      tenant.stripeCustomerId,
      `${baseUrl}/dashboard/billing`
    );

    return NextResponse.json({ success: true, data: { url: portalSession.url } });
  } catch (error: unknown) {
    console.error("Portal error:", error);

    // Handle deleted/invalid Stripe customer — clear stale ID so tenant can re-subscribe
    const stripeErr = error as { type?: string; code?: string };
    if (stripeErr.type === "StripeInvalidRequestError" && stripeErr.code === "resource_missing") {
      return NextResponse.json(
        { success: false, error: "Your billing account was not found. Please contact support or re-subscribe to a plan." },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: false, error: "Failed to create portal session" }, { status: 500 });
  }
}
