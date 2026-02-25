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
        },
        businessHours: { orderBy: { day: "asc" } },
      },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "Business not found" }, { status: 404 });
    }

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
        services: tenant.services,
        businessHours: tenant.businessHours,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
