"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingPage } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminAnalyticsPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      return json.data;
    },
  });

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader title="Analytics" description="Platform-wide analytics and insights" />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tenant Growth</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Tenants</span><span className="font-bold">{stats?.totalTenants}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Active</span><span className="font-bold text-green-600">{stats?.activeTenants}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">New This Month</span><span className="font-bold text-blue-600">{stats?.newTenantsThisMonth}</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Platform Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Calls</span><span className="font-bold">{stats?.totalCalls}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Appointments</span><span className="font-bold">{stats?.totalAppointments}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Monthly Revenue</span><span className="font-bold text-green-600">${stats?.totalRevenue}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
