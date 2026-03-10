import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalTenants,
      activeTenants,
      totalCalls,
      totalAppointments,
      newTenantsThisMonth,
      subscriptions,
      tenantStats,
      customerInsightsRaw,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.call.count(),
      prisma.appointment.count(),
      prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: true },
      }),
      // Per-tenant stats — single raw SQL with LEFT JOIN counts (no N+1 subqueries)
      prisma.$queryRaw<Array<{
        id: string; name: string; slug: string; status: string;
        industry: string | null; createdAt: Date;
        planName: string | null; subscriptionStatus: string | null; planPrice: number;
        customers: number; appointments: number; calls: number; smsLogs: number;
      }>>`
        SELECT
          t.id, t.name, t.slug, t.status::text, t.industry, t."createdAt",
          p.name as "planName", s.status::text as "subscriptionStatus",
          COALESCE(p.price, 0)::float as "planPrice",
          COALESCE(counts.customers, 0)::int as customers,
          COALESCE(counts.appointments, 0)::int as appointments,
          COALESCE(counts.calls, 0)::int as calls,
          COALESCE(counts."smsLogs", 0)::int as "smsLogs"
        FROM "Tenant" t
        LEFT JOIN "Subscription" s ON s."tenantId" = t.id
        LEFT JOIN "Plan" p ON p.id = s."planId"
        LEFT JOIN LATERAL (
          SELECT
            (SELECT COUNT(*)::int FROM "Customer" WHERE "tenantId" = t.id) as customers,
            (SELECT COUNT(*)::int FROM "Appointment" WHERE "tenantId" = t.id) as appointments,
            (SELECT COUNT(*)::int FROM "Call" WHERE "tenantId" = t.id) as calls,
            (SELECT COUNT(*)::int FROM "SmsLog" WHERE "tenantId" = t.id) as "smsLogs"
        ) counts ON true
        ORDER BY t."createdAt" DESC
        LIMIT 200
      `,
      // Customer cross-tenant insights via raw SQL
      prisma.$queryRaw<Array<{ totalUniqueCustomers: number; multiShopCustomers: number }>>`
        SELECT
          COUNT(DISTINCT phone)::int as "totalUniqueCustomers",
          COUNT(*)::int FILTER (WHERE shop_count >= 2) as "multiShopCustomers"
        FROM (
          SELECT phone, COUNT(DISTINCT "tenantId") as shop_count
          FROM "Customer"
          GROUP BY phone
        ) sub
      `,
    ]);

    const totalRevenue = subscriptions.reduce((sum, sub) => sum + Number(sub.plan?.price || 0), 0);

    // Distribution: how many customers are in 1 shop, 2 shops, 3 shops, etc.
    const distribution = await prisma.$queryRaw<Array<{ shopCount: number; customerCount: number }>>`
      SELECT shop_count::int as "shopCount", COUNT(*)::int as "customerCount"
      FROM (
        SELECT phone, COUNT(DISTINCT "tenantId") as shop_count
        FROM "Customer"
        GROUP BY phone
      ) sub
      GROUP BY shop_count
      ORDER BY shop_count
    `;

    // Top multi-shop customers (connected to 2+ shops)
    const topMultiShopCustomers = await prisma.$queryRaw<
      Array<{ phone: string; name: string; shopCount: number; tenantNames: string }>
    >`
      SELECT
        c.phone,
        MIN(c.name) as name,
        COUNT(DISTINCT c."tenantId")::int as "shopCount",
        STRING_AGG(DISTINCT t.name, ', ') as "tenantNames"
      FROM "Customer" c
      JOIN "Tenant" t ON t.id = c."tenantId"
      GROUP BY c.phone
      HAVING COUNT(DISTINCT c."tenantId") >= 2
      ORDER BY COUNT(DISTINCT c."tenantId") DESC
      LIMIT 20
    `;

    const insights = customerInsightsRaw[0];

    const formattedTenantStats = tenantStats.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      industry: t.industry,
      createdAt: t.createdAt,
      planName: t.planName,
      subscriptionStatus: t.subscriptionStatus,
      monthlyRevenue: t.planPrice,
      customers: t.customers,
      appointments: t.appointments,
      calls: t.calls,
      smsLogs: t.smsLogs,
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalTenants,
        activeTenants,
        totalCalls,
        totalAppointments,
        newTenantsThisMonth,
        totalRevenue,
        tenantStats: formattedTenantStats,
        customerInsights: {
          totalUniqueCustomers: insights?.totalUniqueCustomers ?? 0,
          multiShopCustomers: insights?.multiShopCustomers ?? 0,
          distribution: distribution.map((d) => ({
            shopCount: d.shopCount,
            customerCount: d.customerCount,
          })),
          topMultiShopCustomers,
        },
      },
    });
  } catch (error) {
    console.error("Analytics fetch failed:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}
