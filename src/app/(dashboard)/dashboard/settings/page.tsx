"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingPage } from "@/components/shared/loading";
import { Loader2, Save, Phone } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      const json = await res.json();
      return json.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant"] }),
  });

  if (isLoading) return <LoadingPage />;

  return (
    <div>
      <PageHeader title="Settings" description="Manage your business settings" />
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="hours">Business Hours</TabsTrigger>
          <TabsTrigger value="twilio">Phone</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileSettings tenant={tenant} mutation={updateMutation} />
        </TabsContent>
        <TabsContent value="hours">
          <BusinessHoursSettings tenant={tenant} mutation={updateMutation} />
        </TabsContent>
        <TabsContent value="twilio">
          <PhoneSettings tenant={tenant} mutation={updateMutation} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileSettings({ tenant, mutation }: { tenant: any; mutation: any }) {
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
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Business Profile</CardTitle>
        <CardDescription>Update your business information</CardDescription>
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
        <Button onClick={() => mutation.mutate({ section: "profile", ...form })} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

function BusinessHoursSettings({ tenant, mutation }: { tenant: any; mutation: any }) {
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const [hours, setHours] = useState(
    days.map((day) => {
      const existing = tenant?.businessHours?.find((h: any) => h.day === day);
      return {
        day,
        isOpen: existing?.isOpen ?? (day !== "SUNDAY"),
        openTime: existing?.openTime || "09:00",
        closeTime: existing?.closeTime || "17:00",
      };
    })
  );

  function updateDay(index: number, field: string, value: any) {
    const updated = [...hours];
    updated[index] = { ...updated[index], [field]: value };
    setHours(updated);
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Business Hours</CardTitle>
        <CardDescription>Set your operating hours</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hours.map((h, index) => (
          <div key={h.day} className="flex items-center gap-4 py-2 border-b last:border-0">
            <div className="w-28">
              <span className="text-sm font-medium capitalize">{h.day.toLowerCase()}</span>
            </div>
            <Switch checked={h.isOpen} onCheckedChange={(checked) => updateDay(index, "isOpen", checked)} />
            {h.isOpen ? (
              <div className="flex items-center gap-2">
                <Input type="time" value={h.openTime} onChange={(e) => updateDay(index, "openTime", e.target.value)} className="w-32" />
                <span className="text-muted-foreground">to</span>
                <Input type="time" value={h.closeTime} onChange={(e) => updateDay(index, "closeTime", e.target.value)} className="w-32" />
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Closed</span>
            )}
          </div>
        ))}
        <Button onClick={() => mutation.mutate({ section: "hours", hours })} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Hours
        </Button>
      </CardContent>
    </Card>
  );
}

function PhoneSettings({ tenant, mutation }: { tenant: any; mutation: any }) {
  const [form, setForm] = useState({
    businessPhoneNumber: tenant?.businessPhoneNumber || "",
    ivrGreeting: tenant?.ivrGreeting || "",
    ivrCallbackMessage: tenant?.ivrCallbackMessage || "",
    ivrComplaintMessage: tenant?.ivrComplaintMessage || "",
  });

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Phone Configuration</CardTitle>
        <CardDescription>Manage your phone settings and IVR messages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned Twilio Number - read only */}
        <div className="rounded-lg border p-4 bg-muted/50">
          <Label className="text-xs text-muted-foreground">Assigned Twilio Number</Label>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {tenant?.assignedTwilioNumber || "Not yet assigned — contact your admin"}
            </span>
          </div>
        </div>

        {/* Call forwarding instructions */}
        {tenant?.assignedTwilioNumber && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">Call Forwarding Instructions</p>
            <p className="text-sm text-blue-700 mt-1">
              Forward unanswered calls from your business phone to <span className="font-mono font-semibold">{tenant.assignedTwilioNumber}</span>. Contact your phone carrier to set up conditional call forwarding (busy / no answer / unreachable).
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label>Business Phone Number</Label>
          <Input value={form.businessPhoneNumber} onChange={(e) => setForm({ ...form, businessPhoneNumber: e.target.value })} />
          <p className="text-xs text-muted-foreground">Your main business phone number that customers call.</p>
        </div>

        <div className="space-y-2">
          <Label>IVR Greeting</Label>
          <Textarea value={form.ivrGreeting} onChange={(e) => setForm({ ...form, ivrGreeting: e.target.value })} placeholder="Thank you for calling. We missed your call." />
        </div>
        <div className="space-y-2">
          <Label>Callback Message</Label>
          <Textarea value={form.ivrCallbackMessage} onChange={(e) => setForm({ ...form, ivrCallbackMessage: e.target.value })} placeholder="Press 1 for callback." />
        </div>
        <div className="space-y-2">
          <Label>Complaint Message</Label>
          <Textarea value={form.ivrComplaintMessage} onChange={(e) => setForm({ ...form, ivrComplaintMessage: e.target.value })} placeholder="Press 2 for complaint." />
        </div>

        <Button onClick={() => mutation.mutate({ section: "twilio", ...form })} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Phone Settings
        </Button>
      </CardContent>
    </Card>
  );
}
