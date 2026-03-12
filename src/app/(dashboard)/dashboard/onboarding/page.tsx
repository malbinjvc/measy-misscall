"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { LoadingPage } from "@/components/shared/loading";
import { ONBOARDING_STEPS, INDUSTRIES, TenantData, PlanData } from "@/types";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface OnboardingMutationData {
  step: string;
  data: Record<string, unknown>;
}

interface OnboardingMutationResult {
  success: boolean;
  data?: { checkoutUrl?: string };
}

type OnboardingMutation = UseMutationResult<OnboardingMutationResult, Error, OnboardingMutationData>;
type GoBackMutation = UseMutationResult<unknown, Error, void>;

export default function OnboardingPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery<TenantData>({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      const json = await res.json();
      return json.data;
    },
  });

  const currentStepIndex = ONBOARDING_STEPS.findIndex(
    (s) => s.step === (tenant?.onboardingStep || "BUSINESS_PROFILE")
  );

  const mutation: OnboardingMutation = useMutation({
    mutationFn: async (data: OnboardingMutationData) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save");
      }
      return json;
    },
    onSuccess: (result) => {
      // Handle Stripe redirect
      if (result.data?.checkoutUrl) {
        window.location.href = result.data.checkoutUrl;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });

  const goBackMutation: GoBackMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "GO_BACK", data: {} }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to go back");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });

  // Handle Stripe return — verify payment and advance step
  const sessionId = searchParams.get("session_id");
  useEffect(() => {
    if (!sessionId) return;

    const confirmSubscription = async () => {
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: "CONFIRM_SUBSCRIPTION",
            data: { sessionId },
          }),
        });
        if (!res.ok) {
          const json = await res.json();
          console.error("Subscription confirmation failed:", json.error);
        }
      } catch (err) {
        console.error("Subscription confirmation error:", err);
      } finally {
        queryClient.invalidateQueries({ queryKey: ["tenant"] });
      }
    };
    confirmSubscription();
  }, [sessionId, queryClient]);

  if (isLoading) return <LoadingPage />;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Set Up Your Business</h1>
      <p className="text-muted-foreground mb-8">
        Complete these steps to start receiving automated missed call handling.
      </p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {ONBOARDING_STEPS.map((step, index) => (
          <div key={step.step} className="flex items-center">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                index < currentStepIndex
                  ? "bg-green-100 text-green-700"
                  : index === currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {index < currentStepIndex ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{index + 1}</span>
              )}
              {step.label}
            </div>
            {index < ONBOARDING_STEPS.length - 1 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground mx-1 shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {tenant?.onboardingStep === "BUSINESS_PROFILE" && (
        <BusinessProfileStep tenant={tenant} mutation={mutation} />
      )}
      {tenant?.onboardingStep === "INDUSTRY" && (
        <IndustryStep tenant={tenant} mutation={mutation} goBack={goBackMutation} />
      )}
      {tenant?.onboardingStep === "SUBSCRIPTION" && (
        <SubscriptionStep tenant={tenant} mutation={mutation} goBack={goBackMutation} />
      )}
      {tenant?.onboardingStep === "REVIEW" && (
        <ReviewStep tenant={tenant} mutation={mutation} goBack={goBackMutation} />
      )}
    </div>
  );
}

// ─── Business Profile Step (with inline phone verification) ───────

function BusinessProfileStep({ tenant, mutation }: { tenant: TenantData; mutation: OnboardingMutation }) {
  const [form, setForm] = useState({
    name: tenant?.name || "",
    slug: tenant?.slug || "",
    email: tenant?.email || "",
    phone: tenant?.phone || "",
    address: tenant?.address || "",
    city: tenant?.city || "",
    state: tenant?.state || "",
    zipCode: tenant?.zipCode || "",
    businessPhoneNumber: tenant?.businessPhoneNumber || "",
  });

  // Phone verification state
  const [verified, setVerified] = useState(!!tenant?.phoneVerified);
  const [verifiedPhone, setVerifiedPhone] = useState(tenant?.phoneVerified ? (tenant?.phone || "") : "");
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  // Detect phone change → reset verification
  useEffect(() => {
    if (verified && form.phone !== verifiedPhone) {
      setVerified(false);
      setCodeSent(false);
      setOtp("");
      setVerifyError("");
    }
  }, [form.phone, verified, verifiedPhone]);

  const handleSendCode = async () => {
    setSending(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/onboarding/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send code");
      setCodeSent(true);
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch("/api/onboarding/verify-phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, code: otp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verification failed");
      setVerified(true);
      setVerifiedPhone(form.phone);
    } catch (err: unknown) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Profile</CardTitle>
        <CardDescription>Tell us about your business</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name *</Label>
            <Input id="business-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-slug">URL Slug</Label>
            <Input id="business-slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <p className="text-xs text-muted-foreground">Your page: /shop/{form.slug}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="business-email">Email *</Label>
            <Input
              id="business-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-phone">Phone *</Label>
            <div className="flex gap-2">
              <Input
                id="business-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+14376673153"
                className="flex-1"
              />
              {!verified && !codeSent && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={sending || !form.phone || form.phone.length < 10}
                  className="shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
                  Send Code
                </Button>
              )}
              {verified && (
                <div className="flex items-center text-green-600 shrink-0 px-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
            </div>

            {/* OTP input */}
            {codeSent && !verified && (
              <div className="flex gap-2 mt-2">
                <Input
                  id="phone-verification-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyCode}
                  disabled={verifying || otp.length !== 6}
                  className="shrink-0"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={sending}
                  className="shrink-0"
                >
                  Resend
                </Button>
              </div>
            )}

            {verifyError && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" /> {verifyError}
              </p>
            )}

            {verified && (
              <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3" /> Phone verified
              </p>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-phone-number">Business Phone Number *</Label>
          <Input
            id="business-phone-number"
            placeholder="+15551234567"
            value={form.businessPhoneNumber}
            onChange={(e) => setForm({ ...form, businessPhoneNumber: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            This is your main business phone number that customers call. You will set up call
            forwarding from this number to your assigned Twilio number after onboarding.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="business-address">Address *</Label>
          <Input id="business-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="business-city">City</Label>
            <Input id="business-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-state">Province / State</Label>
            <Input id="business-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-zip-code">Postal Code</Label>
            <Input id="business-zip-code" value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => mutation.mutate({ step: "BUSINESS_PROFILE", data: form })}
          disabled={mutation.isPending || !verified}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
        {!verified && (
          <p className="text-xs text-muted-foreground text-center">
            Please verify your phone number to continue
          </p>
        )}
        {mutation.isError && (
          <p className="text-xs text-destructive text-center">{mutation.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Industry Step ────────────────────────────────────────────────

function IndustryStep({
  tenant,
  mutation,
  goBack,
}: {
  tenant: TenantData;
  mutation: OnboardingMutation;
  goBack: GoBackMutation;
}) {
  const [industry, setIndustry] = useState(tenant?.industry || "");
  const [description, setDescription] = useState(tenant?.description || "");

  // Group industries by category
  const categories = Array.from(new Set(INDUSTRIES.map((i) => i.category)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Industry</CardTitle>
        <CardDescription>Select the industry that best describes your business</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Industry *</Label>
          <Select value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">Select an industry...</option>
            {categories.map((cat) => (
              <optgroup key={cat} label={cat}>
                {INDUSTRIES.filter((i) => i.category === cat).map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Business Description</Label>
          <Textarea
            placeholder="Briefly describe your business and the services you offer..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => goBack.mutate()}
            disabled={goBack.isPending}
          >
            {goBack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronLeft className="h-4 w-4 mr-1" />
            )}
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => mutation.mutate({ step: "INDUSTRY", data: { industry, description } })}
            disabled={mutation.isPending || !industry}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue
          </Button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-destructive text-center">{mutation.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Subscription Step ────────────────────────────────────────────

function SubscriptionStep({
  tenant,
  mutation,
  goBack,
}: {
  tenant: TenantData;
  mutation: OnboardingMutation;
  goBack: GoBackMutation;
}) {
  const { data: plans, isLoading } = useQuery<PlanData[]>({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/public/plans");
      const json = await res.json();
      return json.data;
    },
  });

  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [billingInterval, setBillingInterval] = useState<"annual" | "monthly">("annual");
  const MONTHLY_PREMIUM = 30;

  if (isLoading) return <LoadingPage />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your Plan</CardTitle>
        <CardDescription>Select the plan that fits your business needs. All prices in CAD + 13% HST.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Billing interval toggle */}
        <div className="flex items-center justify-center gap-2 rounded-lg border p-1 bg-muted/50 w-fit mx-auto">
          <button
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              billingInterval === "annual"
                ? "bg-white shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setBillingInterval("annual")}
          >
            Annual (Save ${MONTHLY_PREMIUM}/mo)
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

        <div className="grid sm:grid-cols-3 gap-4">
          {plans?.map((plan) => {
            const displayPrice = billingInterval === "monthly"
              ? (plan.price + MONTHLY_PREMIUM).toFixed(2)
              : plan.price;
            return (
              <div
                key={plan.id}
                className={`rounded-lg border-2 p-4 cursor-pointer transition ${
                  selectedPlan === plan.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-2xl font-bold mt-1">
                  ${displayPrice}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mo{billingInterval === "annual" ? " (billed annually)" : ""}
                  </span>
                </p>
                {billingInterval === "monthly" && (
                  <p className="text-xs text-muted-foreground line-through">${plan.price}/mo with annual</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                <ul className="mt-3 space-y-1">
                  {plan.features?.map((f) => (
                    <li key={f} className="text-xs flex items-center gap-1">
                      <Check className="h-3 w-3 text-green-600" /> {f}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  {plan.maxCalls} calls | {plan.maxSms} SMS | {plan.maxStaff} staff
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => goBack.mutate()}
            disabled={goBack.isPending}
          >
            {goBack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronLeft className="h-4 w-4 mr-1" />
            )}
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => mutation.mutate({ step: "SUBSCRIPTION", data: { planId: selectedPlan, billingInterval } })}
            disabled={mutation.isPending || !selectedPlan}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tenant?.stripeCustomerId ? "Subscribe & Continue" : "Continue"}
          </Button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-destructive text-center">{mutation.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Review Step ──────────────────────────────────────────────────

function ReviewStep({
  tenant,
  mutation,
  goBack,
}: {
  tenant: TenantData;
  mutation: OnboardingMutation;
  goBack: GoBackMutation;
}) {
  const { update: updateSession } = useSession();
  const industryLabel = INDUSTRIES.find((i) => i.value === tenant?.industry)?.label || tenant?.industry || "Not set";

  const handleGoLive = () => {
    mutation.mutate(
      { step: "REVIEW", data: {} },
      {
        onSuccess: async () => {
          // Refresh the session so the JWT token gets updated tenantStatus=ACTIVE
          // Without this, the middleware still sees ONBOARDING and redirects back
          await updateSession();
          window.location.href = "/dashboard";
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review & Go Live</CardTitle>
        <CardDescription>Review your setup and launch your business page</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Business Name</p>
            <p className="font-medium">{tenant?.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Public Page</p>
            <p className="font-medium text-primary">/shop/{tenant?.slug}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Industry</p>
            <p className="font-medium">{industryLabel}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Business Phone Number</p>
            <p className="font-medium">{tenant?.businessPhoneNumber || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Assigned Twilio Number</p>
            <p className="font-medium">
              {tenant?.assignedTwilioNumber || "Set up in Settings → Phone"}
            </p>
          </div>
        </div>

        {tenant?.assignedTwilioNumber && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">Call Forwarding Setup</p>
            <p className="text-sm text-blue-700 mt-1">
              Set up call forwarding from your business phone ({tenant?.businessPhoneNumber}) to your
              assigned Twilio number ({tenant?.assignedTwilioNumber}) through your carrier. This
              ensures missed calls are handled automatically.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => goBack.mutate()}
            disabled={goBack.isPending}
          >
            {goBack.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronLeft className="h-4 w-4 mr-1" />
            )}
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={handleGoLive}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Go Live
          </Button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-destructive text-center">{mutation.error.message}</p>
        )}
      </CardContent>
    </Card>
  );
}
