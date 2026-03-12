import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { addFunds, getOrCreateWallet } from "@/lib/wallet";
import { calculateTotalWithFees } from "@/lib/tax";

// POST - manual recharge
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await req.json();
    const amount = body.amount;

    if (typeof amount !== "number" || amount < 10 || amount > 500) {
      return NextResponse.json(
        { success: false, error: "Amount must be between $10 and $500" },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: "No payment method on file. Please update billing first." },
        { status: 400 }
      );
    }

    // Get payment method
    const paymentMethods = await stripe.paymentMethods.list({
      customer: tenant.stripeCustomerId,
      type: "card",
      limit: 1,
    });

    if (paymentMethods.data.length === 0) {
      return NextResponse.json(
        { success: false, error: "No payment method on file. Please add a card in billing settings." },
        { status: 400 }
      );
    }

    // Calculate tax + Stripe processing fee
    const { subtotal, tax, stripeFee, total } = calculateTotalWithFees(amount);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100),
      currency: "cad",
      customer: tenant.stripeCustomerId,
      payment_method: paymentMethods.data[0].id,
      off_session: true,
      confirm: true,
      description: `Measy Wallet Recharge - $${subtotal.toFixed(2)} + HST $${tax.toFixed(2)} + fee $${stripeFee.toFixed(2)} = $${total.toFixed(2)} CAD`,
      metadata: {
        tenantId,
        type: "wallet_manual_recharge",
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        stripeFee: stripeFee.toFixed(2),
      },
    });

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { success: false, error: "Payment failed. Please check your payment method." },
        { status: 400 }
      );
    }

    // Only add the subtotal (credit amount) to the wallet — tax + fee are platform revenue
    const wallet = await addFunds(
      tenantId,
      subtotal,
      "MANUAL_RECHARGE",
      `Manual recharge $${subtotal.toFixed(2)} CAD (charged $${total.toFixed(2)} incl. HST + processing fee)`,
      paymentIntent.id
    );

    return NextResponse.json({
      success: true,
      data: { balance: Number(wallet.balance), charged: total, tax, stripeFee },
    });
  } catch (error) {
    console.error("Wallet recharge error:", error);
    return NextResponse.json({ success: false, error: "Recharge failed" }, { status: 500 });
  }
}
