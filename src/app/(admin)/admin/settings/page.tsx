"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingPage } from "@/components/shared/loading";
import { Loader2, Save, CheckCircle2, XCircle, Phone, MessageSquare, Volume2 } from "lucide-react";

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
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to save settings");
      }
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-settings"] }),
  });

  if (isLoading || !settings) return <LoadingPage />;

  return <SettingsForm settings={settings} mutation={mutation} />;
}

function SettingsForm({ settings, mutation }: { settings: any; mutation: any }) {
  const [form, setForm] = useState({
    sharedTwilioSid: settings.sharedTwilioSid || "",
    sharedTwilioToken: settings.sharedTwilioToken || "",
    elevenlabsApiKey: settings.elevenlabsApiKey || "",
    elevenlabsVoiceId: settings.elevenlabsVoiceId || "",
    maintenanceMode: settings.maintenanceMode || false,
  });
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");

  const isConnected = !!(settings.sharedTwilioSid && settings.sharedTwilioToken);

  async function handleTestConnection() {
    const sid = form.sharedTwilioSid.trim();
    const token = form.sharedTwilioToken.trim();

    if (!sid || !token) {
      setTestStatus("error");
      setTestMessage("Enter both Account SID and Auth Token first.");
      return;
    }

    setTestStatus("testing");
    setTestMessage("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sid, token }),
      });
      const result = await res.json();

      if (result.success) {
        setTestStatus("success");
        setTestMessage(`Connected to "${result.accountName}"`);
      } else {
        setTestStatus("error");
        setTestMessage(result.error || "Connection failed.");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("Network error. Could not reach the server.");
    }
  }

  return (
    <div>
      <PageHeader title="Platform Settings" description="Configure platform-wide settings" />

      <div className="space-y-6">
        {/* Twilio Connection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Twilio Account</CardTitle>
                <CardDescription>Connect your Twilio account to enable calls and SMS for all tenants</CardDescription>
              </div>
              {isConnected ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
                  <XCircle className="h-4 w-4" /> Not connected
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Account SID</Label>
              <Input
                value={form.sharedTwilioSid}
                onChange={(e) => setForm((prev) => ({ ...prev, sharedTwilioSid: e.target.value }))}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label>Auth Token</Label>
              <Input
                type="password"
                value={form.sharedTwilioToken}
                onChange={(e) => setForm((prev) => ({ ...prev, sharedTwilioToken: e.target.value }))}
                placeholder="Enter your Twilio Auth Token"
              />
            </div>

            {/* Test result */}
            {testStatus === "success" && (
              <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <p className="text-sm text-green-700">{testMessage}</p>
              </div>
            )}
            {testStatus === "error" && (
              <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
                <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">{testMessage}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleTestConnection} disabled={testStatus === "testing"}>
                {testStatus === "testing" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                Test Connection
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Twilio phone numbers are assigned to individual tenants from the Tenants page.
            </p>
          </CardContent>
        </Card>

        {/* ElevenLabs TTS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" /> ElevenLabs TTS
                </CardTitle>
                <CardDescription>Configure ElevenLabs for high-quality IVR voice generation</CardDescription>
              </div>
              {form.elevenlabsApiKey ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <CheckCircle2 className="h-4 w-4" /> Configured
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                  Not configured
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.elevenlabsApiKey}
                onChange={(e) => setForm((prev) => ({ ...prev, elevenlabsApiKey: e.target.value }))}
                placeholder="Enter your ElevenLabs API key"
              />
            </div>
            <div className="space-y-2">
              <Label>Voice ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                value={form.elevenlabsVoiceId}
                onChange={(e) => setForm((prev) => ({ ...prev, elevenlabsVoiceId: e.target.value }))}
                placeholder="21m00Tcm4TlvDq8ikWAM (Rachel — default)"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to use the default &quot;Rachel&quot; voice. Find voice IDs in your ElevenLabs dashboard.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fixed IVR Template Preview */}
        <Card>
          <CardHeader>
            <CardTitle>IVR & SMS Templates</CardTitle>
            <CardDescription>
              These fixed templates are used for all tenants. The business name is automatically inserted from each tenant&apos;s profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* IVR Greeting */}
            <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">IVR Greeting (Voice)</Label>
              </div>
              <p className="text-sm text-muted-foreground italic">
                &ldquo;You have reached <span className="font-semibold text-foreground">[Business Name]</span>. We could not take your call. Press 1 to receive a booking link by text. By pressing 1, you agree to receive that message. Press 2 to request a callback.&rdquo;
              </p>
            </div>

            {/* Press 1 SMS */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                <Label className="text-sm font-medium text-blue-900">Press 1 — SMS Reply</Label>
              </div>
              <p className="text-sm text-blue-800">
                Hi from <span className="font-semibold">[Business Name]</span>! We&apos;re sorry we missed your call. Check out our services and book an appointment here: <span className="font-mono text-xs">[Shop Link]</span>
              </p>
            </div>

            {/* Press 2 SMS */}
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amber-600" />
                <Label className="text-sm font-medium text-amber-900">Press 2 — SMS Reply (Callback Request)</Label>
              </div>
              <p className="text-sm text-amber-800">
                Hi from <span className="font-semibold">[Business Name]</span>! We received your callback request. Our team will get back to you shortly. Thank you for your patience!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Maintenance */}
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
              <Switch
                checked={form.maintenanceMode}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, maintenanceMode: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {mutation.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
            <XCircle className="h-4 w-4 text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{(mutation.error as Error)?.message || "Failed to save settings."}</p>
          </div>
        )}

        {mutation.isSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-3">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-700">Settings saved successfully.</p>
          </div>
        )}

        <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
