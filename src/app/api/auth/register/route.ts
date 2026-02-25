import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { registerSchema } from "@/lib/validations";
import { generateSlug } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = registerSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "Email already registered" },
        { status: 400 }
      );
    }

    // Generate unique slug
    let slug = generateSlug(validated.businessName);
    const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 12);

    // Create tenant and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: validated.businessName,
          slug,
          email: validated.email,
          phone: validated.phone || null,
          status: "ONBOARDING",
          onboardingStep: "BUSINESS_PROFILE",
        },
      });

      const user = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          password: hashedPassword,
          phone: validated.phone || null,
          role: "TENANT_OWNER",
          tenantId: tenant.id,
        },
      });

      return { user, tenant };
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: result.user.id,
        tenantId: result.tenant.id,
        slug: result.tenant.slug,
      },
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed" },
      { status: 500 }
    );
  }
}
