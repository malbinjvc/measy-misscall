import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { normalizePhoneNumber } from "@/lib/utils";
import { logAdminAction } from "@/lib/admin-log";
import { releaseTwilioNumber, queueTwilioCleanup } from "@/lib/twilio-cleanup";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = searchParams.get("status");

    const where: any = {};
    if (status) where.status = status;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { users: true, calls: true, appointments: true } },
          subscription: { include: { plan: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: tenants, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { id, status, assignedTwilioNumber } = await req.json();

    // Fetch current tenant state for logging
    const currentTenant = await prisma.tenant.findUnique({
      where: { id },
      select: { name: true, status: true, assignedTwilioNumber: true },
    });

    // If suspending or disabling, release the tenant's Twilio number
    if (status === "SUSPENDED" || status === "DISABLED") {
      if (currentTenant?.assignedTwilioNumber) {
        const released = await releaseTwilioNumber(currentTenant.assignedTwilioNumber);
        // Clear the number from the tenant record
        await prisma.tenant.update({
          where: { id },
          data: { assignedTwilioNumber: null },
        });
        await logAdminAction({
          action: "TWILIO_NUMBER_RELEASED",
          details: released
            ? `Released Twilio number ${currentTenant.assignedTwilioNumber} from "${currentTenant.name}" due to status change to ${status}`
            : `Failed to release Twilio number ${currentTenant.assignedTwilioNumber} from "${currentTenant.name}" — manual cleanup may be needed`,
          tenantId: id,
          tenantName: currentTenant.name,
          userId: session.user.id,
          userName: session.user.name || undefined,
          status: released ? "SUCCESS" : "FAILED",
          metadata: { phoneNumber: currentTenant.assignedTwilioNumber, reason: `status_change_to_${status}` },
        });
        // Queue for retry if the initial release failed
        if (!released) {
          await queueTwilioCleanup({
            phoneNumber: currentTenant.assignedTwilioNumber,
            tenantId: id,
            tenantName: currentTenant.name,
            reason: `status_change_to_${status}`,
          });
        }
      }
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedTwilioNumber !== undefined) {
      const numberToAssign = normalizePhoneNumber(assignedTwilioNumber);
      if (numberToAssign) {
        const existing = await prisma.tenant.findFirst({
          where: { assignedTwilioNumber: numberToAssign, id: { not: id } },
        });
        if (existing) {
          return NextResponse.json(
            { success: false, error: `This number is already assigned to "${existing.name}"` },
            { status: 400 }
          );
        }
      }
      updateData.assignedTwilioNumber = numberToAssign;
    }

    const tenant = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    if (status && currentTenant) {
      await logAdminAction({
        action: "TENANT_STATUS_CHANGED",
        details: `Changed "${currentTenant.name}" status from ${currentTenant.status} to ${status}`,
        tenantId: id,
        tenantName: currentTenant.name,
        userId: session.user.id,
        userName: session.user.name || undefined,
        metadata: { oldStatus: currentTenant.status, newStatus: status },
      });
    }

    return NextResponse.json({ success: true, data: tenant });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { tenantId } = await req.json();
    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId is required" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription: true },
    });

    if (!tenant) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    // Release Twilio number before deleting tenant
    if (tenant.assignedTwilioNumber) {
      const released = await releaseTwilioNumber(tenant.assignedTwilioNumber);
      await logAdminAction({
        action: "TWILIO_NUMBER_RELEASED",
        details: released
          ? `Released Twilio number ${tenant.assignedTwilioNumber} from "${tenant.name}" before tenant deletion`
          : `Failed to release Twilio number ${tenant.assignedTwilioNumber} from "${tenant.name}" — manual cleanup may be needed`,
        tenantId,
        tenantName: tenant.name,
        userId: session.user.id,
        userName: session.user.name || undefined,
        status: released ? "SUCCESS" : "FAILED",
        metadata: { phoneNumber: tenant.assignedTwilioNumber, reason: "tenant_deletion" },
      });
      // Queue for retry if the initial release failed
      if (!released) {
        await queueTwilioCleanup({
          phoneNumber: tenant.assignedTwilioNumber,
          tenantId,
          tenantName: tenant.name,
          reason: "tenant_deletion",
        });
      }
    }

    // Cancel Stripe subscription and customer (non-blocking — don't let Stripe failure prevent deletion)
    try {
      if (tenant.subscription?.stripeSubscriptionId) {
        await stripe.subscriptions.cancel(tenant.subscription.stripeSubscriptionId);
      }
      if (tenant.stripeCustomerId) {
        await stripe.customers.del(tenant.stripeCustomerId);
      }
    } catch (stripeError: any) {
      console.warn("Stripe cleanup failed (non-blocking):", stripeError.message);
    }

    await prisma.tenant.delete({ where: { id: tenantId } });

    await logAdminAction({
      action: "TENANT_DELETED",
      details: `Deleted tenant "${tenant.name}"`,
      tenantId,
      tenantName: tenant.name,
      userId: session.user.id,
      userName: session.user.name || undefined,
      metadata: { tenantEmail: tenant.email },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Tenant delete failed:", error);
    return NextResponse.json({ success: false, error: error.message || "Delete failed" }, { status: 500 });
  }
}
