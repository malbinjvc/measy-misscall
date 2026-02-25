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
import { Loader2, Save, Copy, Check } from "lucide-react";

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
          <TwilioSettings tenant={tenant} mutation={updateMutation} />
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

function TwilioSettings({ tenant, mutation }: { tenant: any; mutation: any }) {
  const [form, setForm] = useState({
    useSharedTwilio: tenant?.useSharedTwilio ?? true,
    twilioAccountSid: tenant?.twilioAccountSid || "",
    twilioAuthToken: tenant?.twilioAuthToken || "",
    twilioPhoneNumber: tenant?.twilioPhoneNumber || "",
    forwardingNumber: tenant?.forwardingNumber || "",
    ivrGreeting: tenant?.ivrGreeting || "",
    ivrCallbackMessage: tenant?.ivrCallbackMessage || "",
    ivrComplaintMessage: tenant?.ivrComplaintMessage || "",
    dialTimeout: tenant?.dialTimeout || 20,
  });
  const [copied, setCopied] = useState(false);

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/twilio/voice` : "";

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Phone Configuration</CardTitle>
        <CardDescription>Configure your Twilio phone system and IVR messages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 bg-muted/50">
          <Label className="text-xs text-muted-foreground">Webhook URL (paste in Twilio console)</Label>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-sm flex-1 truncate">{webhookUrl}</code>
            <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Use Shared Phone System</p>
            <p className="text-sm text-muted-foreground">Use platform Twilio account</p>
          </div>
          <Switch checked={form.useSharedTwilio} onCheckedChange={(checked) => setForm({ ...form, useSharedTwilio: checked })} />
        </div>

        {!form.useSharedTwilio && (
          <div className="space-y-4 rounded-lg border p-4">
            <div className="space-y-2">
              <Label>Twilio Account SID</Label>
              <Input value={form.twilioAccountSid} onChange={(e) => setForm({ ...form, twilioAccountSid: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Twilio Auth Token</Label>
              <Input type="password" value={form.twilioAuthToken} onChange={(e) => setForm({ ...form, twilioAuthToken: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Twilio Phone Number</Label>
              <Input value={form.twilioPhoneNumber} onChange={(e) => setForm({ ...form, twilioPhoneNumber: e.target.value })} />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Forwarding Number</Label>
          <Input value={form.forwardingNumber} onChange={(e) => setForm({ ...form, forwardingNumber: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label>Dial Timeout (seconds)</Label>
          <Input type="number" value={form.dialTimeout} onChange={(e) => setForm({ ...form, dialTimeout: parseInt(e.target.value) || 20 })} className="w-24" />
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
