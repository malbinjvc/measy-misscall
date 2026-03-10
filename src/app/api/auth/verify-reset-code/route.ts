import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashOtp } from "@/lib/crypto";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const ipLimit = checkRateLimit(`verify-reset-ip:${ip}`, { max: 10, windowSec: 60 });

    if (!ipLimit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = verifyCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, code } = parsed.data;
    const hashedCode = hashOtp(code);

    const verification = await prisma.phoneVerification.findFirst({
      where: {
        phone: email.toLowerCase(),
        code: hashedCode,
        verified: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verification) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
