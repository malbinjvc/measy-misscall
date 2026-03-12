import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe, upsertSubscriptionFromStripe } from "@/lib/stripe";
import { z } from "zod";

const confirmSchema = z.object({
  sessionId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = confirmSchema.parse(await req.json());
    const tenantId = session.user.tenantId;

    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      checkoutSession.payment_status !== "paid" ||
      checkoutSession.metadata?.tenantId !== tenantId
    ) {
      return NextResponse.json(
        { success: false, error: "Payment not completed" },
        { status: 400 }
      );
    }

    const subscriptionId = checkoutSession.subscription as string;
    if (subscriptionId) {
      await upsertSubscriptionFromStripe(tenantId, subscriptionId);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Confirm subscription error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to confirm subscription" },
      { status: 500 }
    );
  }
}
