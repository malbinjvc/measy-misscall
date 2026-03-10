import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { tenantId } = await request.json();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { impersonatingTenantId: tenantId },
    });

    await prisma.adminLog.create({
      data: {
        action: "IMPERSONATION_START",
        details: `Admin started impersonating tenant: ${tenant.name}`,
        tenantId: tenant.id,
        tenantName: tenant.name,
        userId: session.user.id,
        userName: session.user.name,
      },
    });

    return NextResponse.json({ success: true, tenantName: tenant.name });
  } catch (error) {
    console.error("Impersonation start failed:", error);
    return NextResponse.json({ success: false, error: "Failed to start impersonation" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Get current impersonation target for logging
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { impersonatingTenantId: true },
    });

    let tenantName = "Unknown";
    if (user?.impersonatingTenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.impersonatingTenantId },
        select: { name: true },
      });
      tenantName = tenant?.name ?? "Deleted Tenant";
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { impersonatingTenantId: null },
    });

    await prisma.adminLog.create({
      data: {
        action: "IMPERSONATION_STOP",
        details: `Admin stopped impersonating tenant: ${tenantName}`,
        tenantId: user?.impersonatingTenantId,
        tenantName,
        userId: session.user.id,
        userName: session.user.name,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Impersonation stop failed:", error);
    return NextResponse.json({ success: false, error: "Failed to stop impersonation" }, { status: 500 });
  }
}
