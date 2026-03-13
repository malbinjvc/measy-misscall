import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { stripe } from "@/lib/stripe";
import { normalizePhoneNumber, sanitizePagination } from "@/lib/utils";
import { logAdminAction } from "@/lib/admin-log";
import { releaseTwilioNumber, queueTwilioCleanup } from "@/lib/twilio-cleanup";
import { getErrorMessage } from "@/lib/errors";
import { updateTenantAdminSchema, deleteTenantSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const { page, pageSize } = sanitizePagination(searchParams.get("page"), searchParams.get("pageSize"));
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim().slice(0, 100);

    const where: Prisma.TenantWhereInput = {};
    if (status) where.status = status as Prisma.EnumTenantStatusFilter;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          phone: true,
          status: true,
          industry: true,
          createdAt: true,
          updatedAt: true,
          assignedTwilioNumber: true,
          businessPhoneNumber: true,
          stripeCustomerId: true,
          customDomain: true,
          customDomainVerified: true,
          logoUrl: true,
          // Exclude websiteConfig (500KB+) and expensive count subqueries
          _count: { select: { users: true } },
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

    const { id, status, assignedTwilioNumber } = updateTenantAdminSchema.parse(await req.json());

    // All DB operations in a single transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      const currentTenant = await tx.tenant.findUnique({
        where: { id },
        select: { name: true, status: true, assignedTwilioNumber: true },
      });

      const updateData: Prisma.TenantUpdateInput = {};
      if (status) updateData.status = status;

      if (assignedTwilioNumber !== undefined) {
        const numberToAssign = normalizePhoneNumber(assignedTwilioNumber);
        if (numberToAssign) {
          const existing = await tx.tenant.findFirst({
            where: { assignedTwilioNumber: numberToAssign, id: { not: id } },
          });
          if (existing) {
            return { conflict: `This number is already assigned to "${existing.name}"` } as const;
          }
        }
        updateData.assignedTwilioNumber = numberToAssign;
      }

      // If suspending or disabling, clear the Twilio number in the DB
      if ((status === "SUSPENDED" || status === "DISABLED") && currentTenant?.assignedTwilioNumber) {
        updateData.assignedTwilioNumber = null;
      }

      const tenant = await tx.tenant.update({
        where: { id },
        data: updateData,
      });

      return { tenant, currentTenant } as const;
    });

    if ("conflict" in result) {
      return NextResponse.json({ success: false, error: result.conflict }, { status: 400 });
    }

    const { tenant, currentTenant } = result;

    // Release Twilio number AFTER transaction (external API call, non-blocking)
    if ((status === "SUSPENDED" || status === "DISABLED") && currentTenant?.assignedTwilioNumber) {
      const released = await releaseTwilioNumber(currentTenant.assignedTwilioNumber);
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
      if (!released) {
        await queueTwilioCleanup({
          phoneNumber: currentTenant.assignedTwilioNumber,
          tenantId: id,
          tenantName: currentTenant.name,
          reason: `status_change_to_${status}`,
        });
      }
    }

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

    const { tenantId } = deleteTenantSchema.parse(await req.json());

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
    } catch (stripeError: unknown) {
      console.warn("Stripe cleanup failed (non-blocking):", getErrorMessage(stripeError));
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
  } catch (error: unknown) {
    console.error("Tenant delete failed:", error);
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  }
}
