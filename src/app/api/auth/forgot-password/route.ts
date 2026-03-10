import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import prisma from "@/lib/prisma";
import { hashOtp } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const { email } = parsed.data;

    // Rate limit: 5 requests per email per 10 minutes
    const emailLimit = checkRateLimit(`forgot-pw:${email.toLowerCase()}`, { max: 5, windowSec: 600 });
    const ipLimit = checkRateLimit(`forgot-pw-ip:${ip}`, { max: 10, windowSec: 600 });

    if (!emailLimit.allowed || !ipLimit.allowed) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    // Look up user — reject if not found
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user) {
      return NextResponse.json({ error: "No account found with this email address" }, { status: 404 });
    }

    // Delete any existing unused codes for this email
    await prisma.phoneVerification.deleteMany({
      where: { phone: email.toLowerCase(), verified: false },
    });

    const code = randomInt(100000, 999999).toString();
    const hashedCode = hashOtp(code);

    await prisma.phoneVerification.create({
      data: {
        phone: email.toLowerCase(),
        code: hashedCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    try {
      await sendPasswordResetEmail(email, code);
    } catch (emailErr) {
      console.error("Failed to send reset email:", emailErr);
      return NextResponse.json({ error: "Failed to send reset email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
