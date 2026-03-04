import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { reviewSchema } from "@/lib/validations";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { hashOtp } from "@/lib/crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "10")));
    const skip = (page - 1) * pageSize;

    const [reviews, total, agg] = await Promise.all([
      prisma.review.findMany({
        where: { tenantId: tenant.id, isVerified: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          customerName: true,
          rating: true,
          comment: true,
          imageUrl: true,
          createdAt: true,
        },
      }),
      prisma.review.count({
        where: { tenantId: tenant.id, isVerified: true },
      }),
      prisma.review.aggregate({
        where: { tenantId: tenant.id, isVerified: true },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        reviews,
        total,
        page,
        pageSize,
        averageRating: agg._avg.rating || 0,
        reviewCount: agg._count.rating || 0,
      },
    });
  } catch (error) {
    console.error("Reviews GET error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const ip = getClientIp(req);
    const limit = checkRateLimit(`reviews:${ip}`, { max: 5, windowSec: 600 });
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, status: true },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { customerName, customerPhone, rating, comment, imageUrl, verificationCode } = parsed.data;

    // Hash the incoming verification code to compare against stored hash
    const hashedVerificationCode = hashOtp(verificationCode);

    // Atomically claim the verification code to prevent race conditions
    const claimed = await prisma.phoneVerification.updateMany({
      where: {
        phone: customerPhone,
        code: hashedVerificationCode,
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

    // Create the review
    const review = await prisma.review.create({
      data: {
        tenantId: tenant.id,
        customerName,
        customerPhone,
        rating,
        comment: comment || null,
        imageUrl: imageUrl || null,
        isVerified: true,
      },
      select: {
        id: true,
        customerName: true,
        rating: true,
        comment: true,
        imageUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error) {
    console.error("Reviews POST error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
