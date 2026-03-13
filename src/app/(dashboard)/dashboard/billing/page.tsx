"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingPage } from "@/components/shared/loading";
import { Check, ExternalLink, Loader2, ArrowRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { MONTHLY_PREMIUM } from "@/lib/tax";
import type { PlanData } from "@/types";

const FEATURE_LABELS: Record<string, string> = {
  missed_call_ivr: "Missed Call IVR + SMS",
  appointment_sms: "Appointment SMS",
  auto_confirm: "Auto-confirm Appointments",
  campaigns: "SMS Campaigns",
  review_import: "Review Import",
  custom_domain: "Custom Domain",
  ai_chat: "AI Chatbot",
  custom_dev: "Custom Development",
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading: tenantLoading, isError: tenantError } = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60000,
  });

  const { data: plans, isLoading: plansLoading } = useQuery<PlanData[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/public/plans");
      const json = await res.json();
      return json.data;
    },
    staleTime: 300000,
  });

  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [confirmingSession, setConfirmingSession] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"annual" | "monthly">("annual");

  // Handle Stripe checkout return
  const sessionId = searchParams.get("session_id");
  useEffect(() => {
    if (!sessionId || confirmingSession) return;
    setConfirmingSession(true);

    (async () => {
      try {
        const res = await fetch("/api/stripe/confirm-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok) {
          queryClient.invalidateQueries({ queryKey: ["tenant"] });
          queryClient.invalidateQueries({ queryKey: ["plan-features"] });
          // Clean URL
          window.history.replaceState({}, "", "/dashboard/billing");
        }
      } catch {
        // silent — subscription may have been confirmed by webhook already
      } finally {
        setConfirmingSession(false);
      }
    })();
  }, [sessionId, confirmingSession, queryClient]);

  async function openPortal() {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const data = await res.json();
      if (data.success && data.data?.url) {
        window.open(data.data.url, "_blank");
      } else {
        setPortalError(data.error || "Failed to open billing portal");
      }
    } catch {
      setPortalError("Failed to connect to billing service");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleChangePlan(planId: string) {
    setUpgradingPlanId(planId);
    setUpgradeError(null);
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingInterval }),
      });
      const data = await res.json();

      if (!data.success) {
        setUpgradeError(data.error || "Failed to change plan");
        return;
      }

      if (data.data?.url) {
        // New subscription — redirect to Stripe Checkout
        window.location.href = data.data.url;
        return;
      }

      if (data.data?.changed) {
        // In-place upgrade — refresh data and redirect to dashboard
        await queryClient.invalidateQueries({ queryKey: ["tenant"] });
        await queryClient.invalidateQueries({ queryKey: ["plan-features"] });
        window.location.href = "/dashboard";
      }
    } catch {
      setUpgradeError("Failed to connect to billing service");
    } finally {
      setUpgradingPlanId(null);
    }
  }

  if (tenantLoading || plansLoading) return <LoadingPage />;
  if (tenantError) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-lg font-semibold mb-1">Failed to load billing</p>
      <p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
    </div>
  );

  const sub = tenant?.subscription;
  const currentPlan = sub?.plan;
  const currentSortOrder = currentPlan?.sortOrder ?? 0;

  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription and billing" />

      {/* Current plan summary */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your active subscription</CardDescription>
          </CardHeader>
          <CardContent>
            {currentPlan ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{currentPlan.name}</span>
                  <StatusBadge status={sub?.status || "ACTIVE"} />
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(currentPlan.price)}
                  <span className="text-sm font-normal text-muted-foreground">/{currentPlan.interval}</span>
                </p>
                {sub?.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground">
                    {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"} on {formatDate(sub.currentPeriodEnd)}
                  </p>
                )}
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
              <div className="space-y-2">
                <Button onClick={openPortal} className="w-full" disabled={portalLoading}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {portalLoading ? "Opening..." : "Manage Billing"}
                </Button>
                {portalError && (
                  <p className="text-sm text-destructive text-center">{portalError}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Billing portal will be available after subscribing to a plan.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billing interval toggle */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Available Plans</h2>
        <div className="flex items-center gap-2 rounded-lg border p-1 bg-muted/50">
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              billingInterval === "annual"
                ? "bg-white shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setBillingInterval("annual")}
          >
            Annual
          </button>
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              billingInterval === "monthly"
                ? "bg-white shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setBillingInterval("monthly")}
          >
            Monthly
          </button>
        </div>
      </div>
      {billingInterval === "annual" && (
        <p className="text-sm text-green-600 font-medium mb-4">
          Save ${MONTHLY_PREMIUM}/mo with annual billing
        </p>
      )}
      {upgradeError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 mb-4">
          <p className="text-sm text-red-700">{upgradeError}</p>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-3">
        {plans?.map((plan) => {
          const isCurrent = currentPlan?.id === plan.id;
          const isUpgrade = plan.sortOrder > currentSortOrder;
          const isDowngrade = plan.sortOrder < currentSortOrder && currentPlan;

          return (
            <Card
              key={plan.id}
              className={`relative transition-shadow ${
                isCurrent
                  ? "border-2 border-primary shadow-md"
                  : "hover:shadow-md"
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold text-white bg-primary">
                  Current Plan
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle>{plan.name}</CardTitle>
                <p className="text-3xl font-bold">
                  ${billingInterval === "monthly" ? (plan.price + MONTHLY_PREMIUM).toFixed(2) : plan.price}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mo{billingInterval === "annual" ? " (billed annually)" : ""}
                  </span>
                </p>
                {billingInterval === "monthly" && (
                  <p className="text-xs text-muted-foreground line-through">${plan.price}/mo with annual</p>
                )}
                <p className="text-xs text-muted-foreground">+ 13% HST</p>
                {plan.description && (
                  <CardDescription>{plan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <p>{plan.maxCalls} calls/month</p>
                  <p>{plan.maxSms} SMS/month</p>
                  <p>Unlimited services</p>
                  <p>{plan.maxStaff} staff members</p>
                </div>

                {plan.features && plan.features.length > 0 && (
                  <div className="border-t pt-3 space-y-1.5">
                    {plan.features.map((f) => (
                      <p key={f} className="text-sm flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        {FEATURE_LABELS[f] || f}
                      </p>
                    ))}
                  </div>
                )}

                {plan.features?.length === 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm text-muted-foreground">Basic features included</p>
                  </div>
                )}

                <div className="pt-2">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isUpgrade ? (
                    <Button
                      className="w-full text-white font-medium"
                      style={{ backgroundColor: "#6040E0" }}
                      disabled={upgradingPlanId !== null}
                      onClick={() => handleChangePlan(plan.id)}
                    >
                      {upgradingPlanId === plan.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="mr-2 h-4 w-4" />
                      )}
                      Upgrade
                    </Button>
                  ) : isDowngrade ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={upgradingPlanId !== null}
                      onClick={() => handleChangePlan(plan.id)}
                    >
                      {upgradingPlanId === plan.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Downgrade
                    </Button>
                  ) : (
                    <Button
                      className="w-full text-white font-medium"
                      style={{ backgroundColor: "#6040E0" }}
                      disabled={upgradingPlanId !== null}
                      onClick={() => handleChangePlan(plan.id)}
                    >
                      {upgradingPlanId === plan.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Subscribe
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
