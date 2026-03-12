import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { normalizePhoneNumber } from "@/lib/utils";
import { hashOtp } from "@/lib/crypto";
import { sendOtpSchema, verifyOtpSchema } from "@/lib/validations";

// POST — Send OTP code
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { phone } = sendOtpSchema.parse(await req.json());
    const normalized = normalizePhoneNumber(phone);

    if (!normalized || normalized.replace(/\+/g, "").length < 10) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number" },
        { status: 400 }
      );
    }

    // Rate limit: max 3 codes per phone in 10 minutes
    const recentCodes = await prisma.phoneVerification.count({
      where: {
        phone: normalized,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });

    if (recentCodes >= 3) {
      return NextResponse.json(
        { success: false, error: "Too many verification attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Generate 6-digit code
    const code = randomInt(100000, 999999).toString();
    const hashedCode = hashOtp(code);

    // Store verification record with 10-min expiry (store hashed code)
    await prisma.phoneVerification.create({
      data: {
        phone: normalized,
        code: hashedCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Reset phoneVerified on the tenant (new code means re-verification needed)
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { phoneVerified: false },
    });

    // Load platform shared Twilio number as 'from'
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "platform-settings" },
      select: { sharedTwilioNumber: true },
    });

    const fromNumber = settings?.sharedTwilioNumber || undefined;

    // Send SMS — onboarding OTP is platform-paid, not charged to tenant
    const result = await sendSms({
      tenantId,
      to: normalized,
      from: fromNumber,
      body: `Your Measy verification code is: ${code}. It expires in 10 minutes.`,
      type: "OTP_VERIFICATION",
      skipWalletCharge: true,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: "Failed to send verification code" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Send OTP error:", error);
    const message = "Failed to send verification code";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// PUT — Verify OTP code
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    const { phone, code } = verifyOtpSchema.parse(await req.json());
    const normalized = normalizePhoneNumber(phone);

    if (!normalized || !code) {
      return NextResponse.json(
        { success: false, error: "Phone and code are required" },
        { status: 400 }
      );
    }

    // Hash the incoming code to compare against stored hash
    const hashedCode = hashOtp(code);

    // Atomically claim the verification code to prevent race conditions
    const claimed = await prisma.phoneVerification.updateMany({
      where: {
        phone: normalized,
        code: hashedCode,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      data: { verified: true },
    });

    if (claimed.count === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired code" },
        { status: 400 }
      );
    }

    // Mark tenant phone as verified
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { phoneVerified: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Verify OTP error:", error);
    const message = "Verification failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
