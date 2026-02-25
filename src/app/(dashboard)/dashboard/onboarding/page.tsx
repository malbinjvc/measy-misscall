"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingPage } from "@/components/shared/loading";
import { ONBOARDING_STEPS, DEFAULT_SERVICES } from "@/types";
import { Check, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";

export default function OnboardingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
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

  const mutation = useMutation({
    mutationFn: async (data: { step: string; data: any }) => {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });

  if (isLoading) return <LoadingPage />;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-2">Set Up Your Business</h1>
      <p className="text-muted-foreground mb-8">Complete these steps to start receiving automated missed call handling.</p>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {ONBOARDING_STEPS.map((step, index) => (
          <div key={step.step} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
              index < currentStepIndex
                ? "bg-green-100 text-green-700"
                : index === currentStepIndex
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
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
      {tenant?.onboardingStep === "SERVICES" && (
        <ServicesStep tenant={tenant} mutation={mutation} />
      )}
      {tenant?.onboardingStep === "SUBSCRIPTION" && (
        <SubscriptionStep tenant={tenant} mutation={mutation} />
      )}
      {tenant?.onboardingStep === "REVIEW" && (
        <ReviewStep tenant={tenant} mutation={mutation} router={router} />
      )}
    </div>
  );
}

function BusinessProfileStep({ tenant, mutation }: { tenant: any; mutation: any }) {
  const [form, setForm] = useState({
    name: tenant?.name || "",
    slug: tenant?.slug || "",
    email: tenant?.email || "",
    phone: tenant?.phone || "",
    address: tenant?.address || "",
    city: tenant?.city || "",
    state: tenant?.state || "",
    zipCode: tenant?.zipCode || "",
    description: tenant?.description || "",
    businessPhoneNumber: tenant?.businessPhoneNumber || "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Profile</CardTitle>
        <CardDescription>Tell us about your business</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Business Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>URL Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
            <p className="text-xs text-muted-foreground">Your page: /shop/{form.slug}</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Business Phone Number</Label>
          <Input
            placeholder="+15551234567"
            value={form.businessPhoneNumber}
            onChange={(e) => setForm({ ...form, businessPhoneNumber: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            This is your main business phone number that customers call. You will set up call forwarding from this number to your assigned Twilio number after onboarding.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>ZIP Code</Label>
            <Input value={form.zipCode} onChange={(e) => setForm({ ...form, zipCode: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <Button
          className="w-full"
          onClick={() => mutation.mutate({ step: "BUSINESS_PROFILE", data: form })}
          disabled={mutation.isPending}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function ServicesStep({ tenant, mutation }: { tenant: any; mutation: any }) {
  const [services, setServices] = useState<Array<{ name: string; duration: number; price: number }>>(
    tenant?.services?.length > 0
      ? tenant.services.map((s: any) => ({ name: s.name, duration: s.duration, price: s.price || 0 }))
      : []
  );

  function addService(name: string = "", duration: number = 60, price: number = 0) {
    setServices([...services, { name, duration, price }]);
  }

  function removeService(index: number) {
    setServices(services.filter((_, i) => i !== index));
  }

  function updateService(index: number, field: string, value: any) {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    setServices(updated);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Services</CardTitle>
        <CardDescription>Add the services your business offers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {services.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p>No services added yet. Add your own or use suggestions below.</p>
          </div>
        )}
        {services.map((service, index) => (
          <div key={index} className="flex items-start gap-2 rounded-lg border p-3">
            <div className="flex-1 grid sm:grid-cols-3 gap-2">
              <Input
                placeholder="Service name"
                value={service.name}
                onChange={(e) => updateService(index, "name", e.target.value)}
              />
              <Input
                type="number"
                placeholder="Duration (min)"
                value={service.duration}
                onChange={(e) => updateService(index, "duration", parseInt(e.target.value) || 0)}
              />
              <Input
                type="number"
                placeholder="Price ($)"
                value={service.price}
                onChange={(e) => updateService(index, "price", parseFloat(e.target.value) || 0)}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeService(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => addService()}>
            <Plus className="h-4 w-4 mr-1" /> Add Custom
          </Button>
          {DEFAULT_SERVICES.filter(
            (ds) => !services.some((s) => s.name === ds.name)
          ).slice(0, 4).map((ds) => (
            <Button
              key={ds.name}
              variant="outline"
              size="sm"
              onClick={() => addService(ds.name, ds.duration, ds.price)}
            >
              + {ds.name}
            </Button>
          ))}
        </div>
        <Button
          className="w-full"
          onClick={() => mutation.mutate({ step: "SERVICES", data: { services } })}
          disabled={mutation.isPending || services.length === 0}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function SubscriptionStep({ tenant, mutation }: { tenant: any; mutation: any }) {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await fetch("/api/public/plans");
      const json = await res.json();
      return json.data;
    },
  });

  const [selectedPlan, setSelectedPlan] = useState<string>("");

  if (isLoading) return <LoadingPage />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose Your Plan</CardTitle>
        <CardDescription>Select the plan that fits your business needs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-4">
          {plans?.map((plan: any) => (
            <div
              key={plan.id}
              className={`rounded-lg border-2 p-4 cursor-pointer transition ${
                selectedPlan === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              <h3 className="font-semibold">{plan.name}</h3>
              <p className="text-2xl font-bold mt-1">${plan.price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
              <ul className="mt-3 space-y-1">
                {plan.features?.map((f: string) => (
                  <li key={f} className="text-xs flex items-center gap-1">
                    <Check className="h-3 w-3 text-green-600" /> {f}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                {plan.maxCalls} calls | {plan.maxSms} SMS | {plan.maxServices} services
              </p>
            </div>
          ))}
        </div>
        <Button
          className="w-full"
          onClick={() => mutation.mutate({ step: "SUBSCRIPTION", data: { planId: selectedPlan } })}
          disabled={mutation.isPending || !selectedPlan}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tenant?.stripeCustomerId ? "Subscribe & Continue" : "Continue"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ReviewStep({ tenant, mutation, router }: { tenant: any; mutation: any; router: any }) {
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
            <p className="text-sm text-muted-foreground">Business Phone Number</p>
            <p className="font-medium">{tenant?.businessPhoneNumber || "Not set"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Assigned Twilio Number</p>
            <p className="font-medium">{tenant?.assignedTwilioNumber || "Pending assignment by admin"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Services</p>
            <p className="font-medium">{tenant?.services?.length || 0} services configured</p>
          </div>
        </div>

        {tenant?.assignedTwilioNumber && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">Call Forwarding Setup</p>
            <p className="text-sm text-blue-700 mt-1">
              Set up call forwarding from your business phone ({tenant?.businessPhoneNumber}) to your assigned Twilio number ({tenant?.assignedTwilioNumber}) through your carrier. This ensures missed calls are handled automatically.
            </p>
          </div>
        )}

        <Button
          className="w-full"
          onClick={() =>
            mutation.mutate(
              { step: "REVIEW", data: {} },
              { onSuccess: () => router.push("/dashboard") }
            )
          }
          disabled={mutation.isPending}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Go Live
        </Button>
      </CardContent>
    </Card>
  );
}
