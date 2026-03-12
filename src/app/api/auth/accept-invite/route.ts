import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { acceptInviteSchema } from "@/lib/validations";
import { ZodError } from "zod";

// GET — validate invite token and return invite details
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ success: false, error: "Missing token" }, { status: 400 });
    }

    const invite = await prisma.staffInvite.findUnique({
      where: { token },
      include: { tenant: { select: { name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ success: false, error: "Invalid or expired invitation" }, { status: 404 });
    }

    if (invite.expiresAt < new Date()) {
      await prisma.staffInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ success: false, error: "This invitation has expired" }, { status: 410 });
    }

    return NextResponse.json({
      success: true,
      data: {
        email: invite.email,
        name: invite.name,
        businessName: invite.tenant.name,
      },
    });
  } catch (error) {
    console.error("Invite validation error:", error);
    return NextResponse.json({ success: false, error: "Failed to validate invitation" }, { status: 500 });
  }
}

// POST — accept invite and create staff account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = acceptInviteSchema.parse(body);

    const invite = await prisma.staffInvite.findUnique({
      where: { token: validated.token },
      include: { tenant: { select: { id: true, name: true } } },
    });

    if (!invite) {
      return NextResponse.json({ success: false, error: "Invalid or expired invitation" }, { status: 404 });
    }

    if (invite.expiresAt < new Date()) {
      await prisma.staffInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ success: false, error: "This invitation has expired" }, { status: 410 });
    }

    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existingUser) {
      await prisma.staffInvite.delete({ where: { id: invite.id } });
      return NextResponse.json(
        { success: false, error: "This email is already registered. Please log in instead." },
        { status: 409 }
      );
    }

    // Password validation
    if (validated.password.length < 8 || !/[A-Z]/.test(validated.password) || !/[a-z]/.test(validated.password) || !/\d/.test(validated.password)) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters with uppercase, lowercase, and a number" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(validated.password, 12);

    // Create user + delete invite in transaction
    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invite.email,
          name: invite.name,
          password: hashedPassword,
          role: "TENANT_STAFF",
          tenantId: invite.tenant.id,
        },
      }),
      prisma.staffInvite.delete({ where: { id: invite.id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, error: "Validation failed" }, { status: 400 });
    }
    console.error("Accept invite error:", error);
    return NextResponse.json({ success: false, error: "Failed to create account" }, { status: 500 });
  }
}
