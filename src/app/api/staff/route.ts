import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { inviteStaffSchema } from "@/lib/validations";
import { sendStaffInviteEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/utils";
import { randomBytes } from "crypto";
import { ZodError } from "zod";

// GET — list staff members + pending invites
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Only owners can manage staff
    if (session.user.role !== "TENANT_OWNER" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Only the business owner can manage team members" }, { status: 403 });
    }

    const tenantId = session.user.tenantId;

    const [members, invites] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.staffInvite.findMany({
        where: { tenantId },
        select: { id: true, name: true, email: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ success: true, data: { members, invites } });
  } catch (error) {
    console.error("Staff list error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch team" }, { status: 500 });
  }
}

// POST — invite a staff member
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TENANT_OWNER" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Only the business owner can invite team members" }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    const body = await req.json();
    const validated = inviteStaffSchema.parse(body);

    // Check if user already exists on this tenant
    const existingUser = await prisma.user.findFirst({
      where: { email: validated.email, tenantId },
    });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "This person is already a team member" },
        { status: 409 }
      );
    }

    // Check if email is already registered on another tenant
    const existingOtherUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existingOtherUser) {
      return NextResponse.json(
        { success: false, error: "This email is already registered with another business" },
        { status: 409 }
      );
    }

    // Check plan limit
    const [tenant, currentCount] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          subscription: { select: { plan: { select: { maxStaff: true } } } },
        },
      }),
      prisma.user.count({ where: { tenantId } }),
    ]);

    const maxStaff = tenant?.subscription?.plan?.maxStaff ?? 1;
    if (currentCount >= maxStaff) {
      return NextResponse.json(
        { success: false, error: `Your plan allows up to ${maxStaff} team member${maxStaff > 1 ? "s" : ""}. Upgrade to add more.` },
        { status: 403 }
      );
    }

    // Generate invite token (48 bytes = 64 chars base64url)
    const token = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Upsert invite (re-send if pending)
    await prisma.staffInvite.upsert({
      where: { tenantId_email: { tenantId, email: validated.email } },
      update: { name: validated.name, token, expiresAt },
      create: {
        tenantId,
        email: validated.email,
        name: validated.name,
        token,
        expiresAt,
      },
    });

    // Send invite email
    const inviteUrl = `${getBaseUrl()}/accept-invite?token=${token}`;
    await sendStaffInviteEmail(
      validated.email,
      validated.name,
      tenant?.name || "Your Business",
      inviteUrl
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const field = issue.path?.[0];
        if (field && !fieldErrors[String(field)]) {
          fieldErrors[String(field)] = issue.message;
        }
      }
      return NextResponse.json({ success: false, error: "Validation failed", fieldErrors }, { status: 400 });
    }
    console.error("Staff invite error:", error);
    return NextResponse.json({ success: false, error: "Failed to send invitation" }, { status: 500 });
  }
}

// DELETE — remove a staff member or cancel an invite
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.tenantId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "TENANT_OWNER" && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Only the business owner can remove team members" }, { status: 403 });
    }

    const tenantId = session.user.tenantId;
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get("userId");
    const inviteId = searchParams.get("inviteId");

    if (userId) {
      // Cannot remove yourself
      if (userId === session.user.id) {
        return NextResponse.json({ success: false, error: "You cannot remove yourself" }, { status: 400 });
      }

      const user = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { role: true },
      });

      if (!user) {
        return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      }

      // Cannot remove another owner
      if (user.role === "TENANT_OWNER") {
        return NextResponse.json({ success: false, error: "Cannot remove a business owner" }, { status: 400 });
      }

      await prisma.user.delete({ where: { id: userId } });
      return NextResponse.json({ success: true });
    }

    if (inviteId) {
      const invite = await prisma.staffInvite.findFirst({
        where: { id: inviteId, tenantId },
      });

      if (!invite) {
        return NextResponse.json({ success: false, error: "Invite not found" }, { status: 404 });
      }

      await prisma.staffInvite.delete({ where: { id: inviteId } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Provide userId or inviteId" }, { status: 400 });
  } catch (error) {
    console.error("Staff remove error:", error);
    return NextResponse.json({ success: false, error: "Failed to remove" }, { status: 500 });
  }
}
