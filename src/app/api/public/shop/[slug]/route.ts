import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      include: {
        services: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { sortOrder: "asc" },
              include: {
                subOptions: {
                  where: { isActive: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
        businessHours: { orderBy: { day: "asc" } },
        reviews: {
          where: { isVerified: true },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            customerName: true,
            rating: true,
            comment: true,
            imageUrl: true,
            createdAt: true,
          },
        },
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

    // Compute review aggregates
    const reviewAgg = await prisma.review.aggregate({
      where: { tenantId: tenant.id, isVerified: true },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Determine AI chatbot eligibility (Professional+ plans: sortOrder >= 2)
    const hasAiChat = tenant.subscription?.plan
      ? tenant.subscription.plan.sortOrder >= 2
      : false;

    return NextResponse.json({
      success: true,
      data: {
        name: tenant.name,
        slug: tenant.slug,
        description: tenant.description,
        phone: tenant.phone,
        address: tenant.address,
        city: tenant.city,
        state: tenant.state,
        zipCode: tenant.zipCode,
        logoUrl: tenant.logoUrl,
        heroMediaUrl: tenant.heroMediaUrl,
        heroMediaType: tenant.heroMediaType,
        services: tenant.services,
        businessHours: tenant.businessHours,
        reviews: tenant.reviews,
        averageRating: reviewAgg._avg.rating || 0,
        reviewCount: reviewAgg._count.rating || 0,
        hasAiChat,
      },
    });
  } catch (error) {
    console.error("Shop API error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
