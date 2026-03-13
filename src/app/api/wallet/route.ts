import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getWalletRatePerUnit } from "@/lib/wallet";

// GET wallet balance and recent transactions
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "15");
    const skip = (page - 1) * limit;

    // Single query: tenant → wallet (with transactions + count) + subscription + plan
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        wallet: {
          include: {
            transactions: {
              orderBy: { createdAt: "desc" },
              take: limit,
              skip,
            },
            _count: { select: { transactions: true } },
          },
        },
        subscription: {
          include: { plan: { select: { maxSms: true, maxCalls: true } } },
        },
      },
    });

    // If no wallet yet, create one
    let wallet = tenant?.wallet;
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: { tenantId },
        include: {
          transactions: { orderBy: { createdAt: "desc" }, take: limit, skip },
          _count: { select: { transactions: true } },
        },
      });
    }

    const subscription = tenant?.subscription;
    const totalCount = wallet._count.transactions;

    const ratePerUnit = await getWalletRatePerUnit();

    // Usage comes from atomic counters — no COUNT queries needed
    return NextResponse.json({
      success: true,
      data: {
        ratePerUnit,
        wallet: {
          balance: Number(wallet.balance),
          autoRecharge: wallet.autoRecharge,
          rechargeThreshold: Number(wallet.rechargeThreshold),
          rechargeAmount: Number(wallet.rechargeAmount),
        },
        usage: {
          smsUsed: wallet.usedSms,
          smsLimit: subscription?.plan?.maxSms || 0,
          callsUsed: wallet.usedCalls,
          callsLimit: subscription?.plan?.maxCalls || 0,
          periodStart: wallet.periodStart || subscription?.currentPeriodStart,
          periodEnd: subscription?.currentPeriodEnd,
        },
        transactions: wallet.transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          balance: Number(t.balance),
          description: t.description,
          createdAt: t.createdAt,
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
    });
  } catch (error) {
    console.error("Wallet GET error:", error);
    return NextResponse.json({ success: false, error: "Failed to load wallet" }, { status: 500 });
  }
}

// PATCH - update wallet settings (auto-recharge toggle, thresholds)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const body = await req.json();
    const { autoRecharge, rechargeThreshold, rechargeAmount } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof autoRecharge === "boolean") updateData.autoRecharge = autoRecharge;
    if (typeof rechargeThreshold === "number" && rechargeThreshold >= 0) updateData.rechargeThreshold = rechargeThreshold;
    if (typeof rechargeAmount === "number" && rechargeAmount >= 10) updateData.rechargeAmount = rechargeAmount;

    const updated = await prisma.wallet.upsert({
      where: { tenantId },
      update: updateData,
      create: { tenantId, ...updateData },
    });

    return NextResponse.json({
      success: true,
      data: {
        balance: Number(updated.balance),
        autoRecharge: updated.autoRecharge,
        rechargeThreshold: Number(updated.rechargeThreshold),
        rechargeAmount: Number(updated.rechargeAmount),
      },
    });
  } catch (error) {
    console.error("Wallet PATCH error:", error);
    return NextResponse.json({ success: false, error: "Failed to update wallet" }, { status: 500 });
  }
}
