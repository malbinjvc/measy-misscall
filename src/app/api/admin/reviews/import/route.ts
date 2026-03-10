import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAdminAction } from "@/lib/admin-log";
import { reviewImportPayloadSchema } from "@/lib/validations";
import { parseRelativeDateToDays, resolveImportDates } from "@/lib/review-date-parser";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 5 imports per minute per admin
    const rl = checkRateLimit(`review-import:${session.user.id}`, { max: 5, windowSec: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many imports. Please wait a minute." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = reviewImportPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tenantId, reviews } = parsed.data;

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    // Parse all relative dates
    const daysAgoValues: number[] = [];
    for (let i = 0; i < reviews.length; i++) {
      const days = parseRelativeDateToDays(reviews[i].relativeDate);
      if (days === null) {
        return NextResponse.json(
          { success: false, error: `Cannot parse date "${reviews[i].relativeDate}" at row ${i + 1}` },
          { status: 400 }
        );
      }
      daysAgoValues.push(days);
    }

    // Resolve collision-free dates
    const resolvedDates = resolveImportDates(daysAgoValues);

    // Create all reviews in a transaction
    const created = await prisma.$transaction(
      reviews.map((review, i) =>
        prisma.review.create({
          data: {
            tenantId,
            customerName: review.customerName,
            customerPhone: null,
            rating: review.rating,
            comment: review.comment || null,
            imageUrl: review.photoUrls[0] || null,
            imageUrls: review.photoUrls,
            importSource: "csv_import",
            isVerified: true,
            createdAt: resolvedDates[i],
          },
        })
      )
    );

    await logAdminAction({
      action: "REVIEWS_IMPORTED",
      details: `Imported ${created.length} reviews for "${tenant.name}"`,
      tenantId,
      tenantName: tenant.name,
      userId: session.user.id,
      userName: session.user.name || undefined,
      metadata: { count: created.length },
    });

    return NextResponse.json({ success: true, data: { imported: created.length } });
  } catch (error) {
    console.error("Review import failed:", error);
    return NextResponse.json({ success: false, error: "Import failed" }, { status: 500 });
  }
}
