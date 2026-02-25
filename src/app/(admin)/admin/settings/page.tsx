"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingPage } from "@/components/shared/loading";
import { Loader2, Save } from "lucide-react";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settings");
      const json = await res.json();
      return json.data;
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-settings"] }),
  });

  const [form, setForm] = useState<any>(null);

  if (isLoading) return <LoadingPage />;
  if (!form && settings) {
    // Initialize form with settings data (using setTimeout to avoid state update during render)
    setTimeout(() => setForm({ ...settings }), 0);
    return <LoadingPage />;
  }
  if (!form) return <LoadingPage />;

  return (
    <div>
      <PageHeader title="Platform Settings" description="Configure platform-wide settings" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Shared Twilio Configuration</CardTitle>
            <CardDescription>Default Twilio credentials for tenants using shared phone system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Account SID</Label><Input value={form.sharedTwilioSid || ""} onChange={(e) => setForm({ ...form, sharedTwilioSid: e.target.value })} /></div>
            <div className="space-y-2"><Label>Auth Token</Label><Input type="password" value={form.sharedTwilioToken || ""} onChange={(e) => setForm({ ...form, sharedTwilioToken: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Twilio phone numbers are assigned per-tenant from the Tenants page.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default IVR Messages</CardTitle>
            <CardDescription>Default messages for new tenants</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Greeting</Label><Textarea value={form.defaultIvrGreeting || ""} onChange={(e) => setForm({ ...form, defaultIvrGreeting: e.target.value })} /></div>
            <div className="space-y-2"><Label>Callback Prompt</Label><Textarea value={form.defaultIvrCallback || ""} onChange={(e) => setForm({ ...form, defaultIvrCallback: e.target.value })} /></div>
            <div className="space-y-2"><Label>Complaint Prompt</Label><Textarea value={form.defaultIvrComplaint || ""} onChange={(e) => setForm({ ...form, defaultIvrComplaint: e.target.value })} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Maintenance Mode</p>
                <p className="text-sm text-muted-foreground">Disable public access temporarily</p>
              </div>
              <Switch checked={form.maintenanceMode || false} onCheckedChange={(checked) => setForm({ ...form, maintenanceMode: checked })} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
