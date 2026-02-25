"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCardSkeleton } from "@/components/shared/loading";
import { Building2, PhoneCall, Calendar, DollarSign, Users, TrendingUp } from "lucide-react";

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      return json.data;
    },
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Platform Overview</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <StatsCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { title: "Total Tenants", value: stats?.totalTenants ?? 0, icon: Building2, color: "text-blue-600" },
    { title: "Active Tenants", value: stats?.activeTenants ?? 0, icon: Users, color: "text-green-600" },
    { title: "Total Calls", value: stats?.totalCalls ?? 0, icon: PhoneCall, color: "text-purple-600" },
    { title: "Total Appointments", value: stats?.totalAppointments ?? 0, icon: Calendar, color: "text-orange-600" },
    { title: "New This Month", value: stats?.newTenantsThisMonth ?? 0, icon: TrendingUp, color: "text-cyan-600" },
    { title: "Revenue", value: `$${stats?.totalRevenue ?? 0}`, icon: DollarSign, color: "text-emerald-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Platform Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
