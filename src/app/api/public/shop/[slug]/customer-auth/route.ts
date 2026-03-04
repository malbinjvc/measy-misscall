import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashOtp } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { signCustomerToken, setCustomerCookie, clearCustomerCookie } from "@/lib/customer-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`customer-auth:${ip}`, { max: 10, windowSec: 60 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const body = await req.json();
    const { phone, code } = body;

    if (!phone || !code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json({ success: false, error: "Invalid verification code" }, { status: 400 });
    }

    const hashedCode = hashOtp(code);

    // Atomically claim the OTP (same pattern as booking route)
    const claimed = await prisma.phoneVerification.updateMany({
      where: {
        phone,
        code: hashedCode,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      data: { verified: true },
    });

    if (claimed.count === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    // Upsert customer — create if first login, otherwise just find
    const customer = await prisma.customer.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone } },
      create: {
        tenantId: tenant.id,
        name: phone, // Default name to phone; user can update later
        phone,
      },
      update: {}, // Don't overwrite existing data on login
    });

    const token = await signCustomerToken({
      customerId: customer.id,
      tenantId: tenant.id,
      phone: customer.phone,
    });

    const response = NextResponse.json({ success: true });
    setCustomerCookie(response, token);
    return response;
  } catch (error) {
    console.error("Customer auth error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const response = NextResponse.json({ success: true });
  clearCustomerCookie(response);
  return response;
}
