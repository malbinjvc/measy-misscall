"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingPage } from "@/components/shared/loading";
import { CreditCard, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function BillingPage() {
  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      const json = await res.json();
      return json.data;
    },
  });

  async function openPortal() {
    const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
    const data = await res.json();
    if (data.success && data.data?.url) {
      window.open(data.data.url, "_blank");
    }
  }

  if (isLoading) return <LoadingPage />;

  const sub = tenant?.subscription;
  const plan = sub?.plan;

  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription and billing" />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your active subscription</CardDescription>
          </CardHeader>
          <CardContent>
            {plan ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{plan.name}</span>
                  <StatusBadge status={sub?.status || "ACTIVE"} />
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground">/{plan.interval}</span>
                </p>
                {sub?.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {formatDate(sub.currentPeriodEnd)}
                  </p>
                )}
                <div className="space-y-1 pt-2">
                  <p className="text-sm">{plan.maxCalls} calls/month</p>
                  <p className="text-sm">{plan.maxSms} SMS/month</p>
                  <p className="text-sm">{plan.maxServices} services</p>
                  <p className="text-sm">{plan.maxStaff} staff members</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No active subscription</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Management</CardTitle>
            <CardDescription>Update payment method, view invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tenant?.stripeCustomerId ? (
              <Button onClick={openPortal} className="w-full">
                <ExternalLink className="mr-2 h-4 w-4" />
                Manage Billing
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Billing portal will be available after subscribing to a plan.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
