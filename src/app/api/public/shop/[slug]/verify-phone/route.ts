import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import prisma from "@/lib/prisma";
import { phoneVerificationSchema } from "@/lib/validations";
import { sendSms } from "@/lib/sms";
import { normalizePhoneNumber, normalizePhoneForStorage } from "@/lib/utils";
import { hashOtp } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`verify-phone:${ip}`, { max: 5, windowSec: 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true, name: true, assignedTwilioNumber: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = phoneVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number" },
        { status: 400 }
      );
    }

    const phone = normalizePhoneForStorage(parsed.data.phone);

    // Rate limit: max 10 codes per phone in 10 minutes (bounded query, not COUNT)
    const recentCodes = await prisma.phoneVerification.findMany({
      where: {
        phone,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true },
      take: 11,
    });

    if (recentCodes.length >= 10) {
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
        phone,
        code: hashedCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send SMS via Twilio
    const fromNumber = normalizePhoneNumber(tenant.assignedTwilioNumber) || undefined;
    const smsResult = await sendSms({
      tenantId: tenant.id,
      to: phone,
      from: fromNumber,
      body: `Your verification code for ${tenant.name} is: ${code}. It expires in 10 minutes.`,
      type: "OTP_VERIFICATION",
    });

    if (!smsResult.success) {
      return NextResponse.json(
        { success: false, error: "Failed to send verification code. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Phone verification error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`verify-code:${ip}`, { max: 10, windowSec: 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const body = await req.json();
    const { code } = body;
    const phone = body.phone ? normalizePhoneForStorage(body.phone) : "";

    if (!phone || !code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json({ success: false, error: "Invalid verification code" }, { status: 400 });
    }

    const hashedCode = hashOtp(code);

    // Check that a valid, unused code exists — do NOT consume it here.
    // The booking route will atomically claim the code to prevent reuse.
    const match = await prisma.phoneVerification.findFirst({
      where: {
        phone,
        code: hashedCode,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      select: { id: true },
    });

    if (!match) {
      return NextResponse.json({ success: false, error: "Invalid or expired verification code" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Phone code verification error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
