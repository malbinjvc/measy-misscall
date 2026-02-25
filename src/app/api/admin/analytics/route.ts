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

    const [totalTenants, activeTenants, totalCalls, totalAppointments, newTenantsThisMonth, subscriptions] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.call.count(),
      prisma.appointment.count(),
      prisma.tenant.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE" },
        include: { plan: true },
      }),
    ]);

    const totalRevenue = subscriptions.reduce((sum, sub) => sum + (sub.plan?.price || 0), 0);

    return NextResponse.json({
      success: true,
      data: { totalTenants, activeTenants, totalCalls, totalAppointments, newTenantsThisMonth, totalRevenue },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch" }, { status: 500 });
  }
}
