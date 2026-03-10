"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingPage } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Eye, Users, Store, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface TenantStat {
  id: string;
  name: string;
  slug: string;
  status: string;
  industry: string | null;
  createdAt: string;
  planName: string | null;
  subscriptionStatus: string | null;
  monthlyRevenue: number;
  customers: number;
  appointments: number;
  calls: number;
  smsLogs: number;
}

interface CustomerInsights {
  totalUniqueCustomers: number;
  multiShopCustomers: number;
  distribution: Array<{ shopCount: number; customerCount: number }>;
  topMultiShopCustomers: Array<{ phone: string; name: string; shopCount: number; tenantNames: string }>;
}

interface AnalyticsData {
  totalTenants: number;
  activeTenants: number;
  totalCalls: number;
  totalAppointments: number;
  newTenantsThisMonth: number;
  totalRevenue: number;
  tenantStats: TenantStat[];
  customerInsights: CustomerInsights;
}

export default function AdminAnalyticsPage() {
  const { data: stats, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60000,
  });

  const [impersonating, setImpersonating] = useState<string | null>(null);

  async function handleImpersonate(tenantId: string) {
    setImpersonating(tenantId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (res.ok) {
        // Force session refresh so JWT cookie gets updated before navigation
        await fetch("/api/auth/session");
        window.location.href = "/dashboard";
      }
    } finally {
      setImpersonating(null);
    }
  }

  if (isLoading) return <LoadingPage />;

  const ci = stats?.customerInsights;

  return (
    <div>
      <PageHeader title="Analytics" description="Platform-wide analytics and insights" />

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
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

      {/* Customer Insights */}
      <h2 className="text-lg font-semibold mb-4">Customer Insights</h2>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Customers</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ci?.totalUniqueCustomers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all shops (by phone)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Multi-Shop Customers</CardTitle>
            <Store className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ci?.multiShopCustomers ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Connected to 2+ businesses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Distribution</CardTitle>
            <BarChart3 className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {ci?.distribution?.map((d) => (
                <div key={d.shopCount} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{d.shopCount} shop{d.shopCount !== 1 ? "s" : ""}</span>
                  <span className="font-medium">{d.customerCount} customers</span>
                </div>
              )) ?? <span className="text-sm text-muted-foreground">No data</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Multi-Shop Customers */}
      {ci?.topMultiShopCustomers && ci.topMultiShopCustomers.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Top Multi-Shop Customers</h2>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Shop Count</TableHead>
                  <TableHead>Connected Businesses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ci.topMultiShopCustomers.map((c) => (
                  <TableRow key={c.phone}>
                    <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="font-bold">{c.shopCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.tenantNames}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tenant Breakdown */}
      <h2 className="text-lg font-semibold mb-4">Tenant Breakdown</h2>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Customers</TableHead>
              <TableHead>Appointments</TableHead>
              <TableHead>Calls</TableHead>
              <TableHead>SMS</TableHead>
              <TableHead>Created</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats?.tenantStats?.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell className="text-sm">{t.industry || "—"}</TableCell>
                <TableCell className="text-sm">{t.planName || "None"}</TableCell>
                <TableCell className="text-sm">${t.monthlyRevenue}</TableCell>
                <TableCell className="text-sm">{t.customers}</TableCell>
                <TableCell className="text-sm">{t.appointments}</TableCell>
                <TableCell className="text-sm">{t.calls}</TableCell>
                <TableCell className="text-sm">{t.smsLogs}</TableCell>
                <TableCell className="text-sm">{formatDate(t.createdAt)}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                    onClick={() => handleImpersonate(t.id)}
                    disabled={impersonating === t.id}
                    title="View as this tenant"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
