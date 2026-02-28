import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { phoneVerificationSchema } from "@/lib/validations";
import { sendSms } from "@/lib/sms";
import { normalizePhoneNumber } from "@/lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
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

    const { phone } = parsed.data;

    // Rate limit: max 3 codes per phone in 10 minutes
    const recentCodes = await prisma.phoneVerification.count({
      where: {
        phone,
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
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store verification record with 10-min expiry
    await prisma.phoneVerification.create({
      data: {
        phone,
        code,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Send SMS via Twilio
    const fromNumber = normalizePhoneNumber(tenant.assignedTwilioNumber) || undefined;
    await sendSms({
      tenantId: tenant.id,
      to: phone,
      from: fromNumber,
      body: `Your verification code for ${tenant.name} is: ${code}. It expires in 10 minutes.`,
      type: "OTP_VERIFICATION",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Phone verification error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
