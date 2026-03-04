"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import type { TenantData, AvailableNumber } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingPage } from "@/components/shared/loading";
import { Loader2, Save, Phone, Image, Upload, X, AlertTriangle, MessageSquare, Volume2, RefreshCw, CheckCircle2 } from "lucide-react";
import { WebsiteBuilder } from "@/components/website-builder";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const queryClient = useQueryClient();

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) throw new Error("Request failed");
      const json = await res.json();
      return json.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to save");
      }
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
          <TabsTrigger value="website">Website</TabsTrigger>
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
        <TabsContent value="website">
          <WebsiteBuilder tenant={tenant} mutation={updateMutation} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type SettingsMutation = UseMutationResult<unknown, Error, Record<string, unknown>>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function ProfileSettings({ tenant, mutation }: { tenant: TenantData; mutation: SettingsMutation }) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
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
    autoConfirmAppointments: tenant?.autoConfirmAppointments || false,
    facebookUrl: tenant?.facebookUrl || "",
    instagramUrl: tenant?.instagramUrl || "",
  });

  const handleNameChange = (newName: string) => {
    const updated: typeof form = { ...form, name: newName };
    if (!slugManuallyEdited) {
      updated.slug = generateSlug(newName);
    }
    setForm(updated);
  };

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
            <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>URL Slug</Label>
            <Input value={form.slug} onChange={(e) => { setSlugManuallyEdited(true); setForm({ ...form, slug: e.target.value }); }} />
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
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label>Auto-confirm appointments</Label>
            <p className="text-sm text-muted-foreground">
              Automatically confirm new appointments instead of leaving them as pending.
            </p>
          </div>
          <Switch
            checked={form.autoConfirmAppointments}
            onCheckedChange={(checked) => setForm({ ...form, autoConfirmAppointments: checked })}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Facebook URL</Label>
            <Input placeholder="https://facebook.com/yourbusiness" value={form.facebookUrl} onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Instagram URL</Label>
            <Input placeholder="https://instagram.com/yourbusiness" value={form.instagramUrl} onChange={(e) => setForm({ ...form, instagramUrl: e.target.value })} />
          </div>
        </div>
        <Button onClick={() => mutation.mutate({ section: "profile", ...form })} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

function BusinessHoursSettings({ tenant, mutation }: { tenant: TenantData; mutation: SettingsMutation }) {
  const queryClient = useQueryClient();
  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const [hours, setHours] = useState(
    days.map((day) => {
      const existing = tenant?.businessHours?.find((h: { day: string; isOpen: boolean; openTime: string; closeTime: string }) => h.day === day);
      return {
        day,
        isOpen: existing?.isOpen ?? (day !== "SUNDAY"),
        openTime: existing?.openTime || "09:00",
        closeTime: existing?.closeTime || "17:00",
      };
    })
  );
  const [affectedWarning, setAffectedWarning] = useState<number | null>(null);

  function updateDay(index: number, field: string, value: string | boolean) {
    const updated = [...hours];
    updated[index] = { ...updated[index], [field]: value };
    setHours(updated);
    setAffectedWarning(null);
  }

  async function handleSave() {
    setAffectedWarning(null);
    mutation.mutate(
      { section: "hours", hours },
      {
        onSuccess: (result: unknown) => {
          // Invalidate cached business hours so appointments page picks up changes
          queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
          queryClient.invalidateQueries({ queryKey: ["business-hours-for-create"] });
          const data = result as { affectedAppointments?: number } | undefined;
          if (data?.affectedAppointments && data.affectedAppointments > 0) {
            setAffectedWarning(data.affectedAppointments);
          }
        },
      }
    );
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
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Hours
        </Button>
        {affectedWarning !== null && affectedWarning > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-sm text-orange-700">
              {affectedWarning} future appointment{affectedWarning > 1 ? "s" : ""} now fall{affectedWarning === 1 ? "s" : ""} outside your updated business hours.
              Check the Appointments calendar for items marked &quot;reschedule needed&quot;.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhoneSettings({ tenant, mutation }: { tenant: TenantData; mutation: SettingsMutation }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    businessPhoneNumber: tenant?.businessPhoneNumber || "",
  });
  const [saveError, setSaveError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const businessName = tenant?.name || "Your Business";
  const shopUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://yoursite.com"}/shop/${tenant?.slug || "your-shop"}`;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Phone Configuration</CardTitle>
        <CardDescription>Manage your phone settings and IVR messages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned Twilio Number */}
        {tenant?.assignedTwilioNumber ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-900">Assigned Number</p>
              <p className="text-lg font-mono text-green-800">{tenant.assignedTwilioNumber}</p>
            </div>
          </div>
        ) : (
          <TwilioNumberSetup tenant={tenant} />
        )}

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

        {/* IVR Greeting Preview */}
        <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">IVR Greeting Preview</Label>
            </div>
            <span className={`text-xs font-medium ${tenant?.ivrAudioUrl ? "text-green-600" : "text-muted-foreground"}`}>
              {tenant?.ivrAudioUrl ? "Custom audio in use" : "Using text-to-speech"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground italic">
            &ldquo;You have reached <span className="font-semibold text-foreground">{businessName}</span>. We could not take your call. Press 1 to receive a booking link by text. By pressing 1, you agree to receive that message. Press 2 to request a callback.&rdquo;
          </p>
          {tenant?.ivrAudioUrl && (
            <audio controls className="w-full" src={tenant.ivrAudioUrl}>
              Your browser does not support the audio element.
            </audio>
          )}
          {genError && (
            <p className="text-sm text-red-600">{genError}</p>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={generating}
              onClick={async () => {
                setGenerating(true);
                setGenError("");
                try {
                  const res = await fetch("/api/settings/regenerate-ivr", { method: "POST" });
                  const json = await res.json();
                  if (json.success) {
                    queryClient.invalidateQueries({ queryKey: ["tenant"] });
                  } else {
                    setGenError(json.error || "Failed to generate audio");
                  }
                } catch {
                  setGenError("Network error. Please try again.");
                } finally {
                  setGenerating(false);
                }
              }}
            >
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : tenant?.ivrAudioUrl ? (
                <RefreshCw className="mr-2 h-4 w-4" />
              ) : (
                <Volume2 className="mr-2 h-4 w-4" />
              )}
              {tenant?.ivrAudioUrl ? "Regenerate Audio" : "Generate Audio"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Generates a high-quality voice greeting via ElevenLabs.
            </p>
          </div>
        </div>

        {/* Press 1 — SMS Reply Preview */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <Label className="text-sm font-medium text-blue-900">Press 1 — SMS Reply</Label>
          </div>
          <p className="text-sm text-blue-800">
            Hi from <span className="font-semibold">{businessName}</span>! We&apos;re sorry we missed your call. Check out our services and book an appointment here: <span className="font-mono text-xs underline break-all">{shopUrl}</span>
          </p>
        </div>

        {/* Press 2 — SMS Reply Preview */}
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-amber-600" />
            <Label className="text-sm font-medium text-amber-900">Press 2 — SMS Reply (Callback Request)</Label>
          </div>
          <p className="text-sm text-amber-800">
            Hi from <span className="font-semibold">{businessName}</span>! We received your callback request. Our team will get back to you shortly. Thank you for your patience!
          </p>
        </div>

        {saveError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        <Button
          onClick={() => {
            setSaveError("");
            mutation.mutate(
              { section: "twilio", ...form },
              {
                onError: (err: Error) => setSaveError(err.message || "Failed to save phone settings."),
              }
            );
          }}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Phone Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function TwilioNumberSetup({ tenant }: { tenant: TenantData }) {
  const queryClient = useQueryClient();

  const locationParts = [tenant?.city, tenant?.state].filter(Boolean);
  const locationLabel = locationParts.length > 0 ? locationParts.join(", ") : null;

  const {
    data: availableNumbers,
    isLoading: searching,
    error: searchError,
  } = useQuery<AvailableNumber[]>({
    queryKey: ["available-numbers"],
    queryFn: async () => {
      const res = await fetch("/api/twilio/available-numbers");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      return json.data;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch("/api/twilio/available-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Purchase failed");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
  });

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm font-medium text-amber-900">
        No phone number assigned yet. Select a number below to enable missed-call handling.
      </p>

      {locationLabel && (
        <p className="text-xs text-muted-foreground">
          Showing numbers near <span className="font-medium text-foreground">{locationLabel}</span>
        </p>
      )}

      {searching && (
        <div className="text-center py-4 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          Searching available numbers{locationLabel ? ` near ${locationLabel}` : ""}...
        </div>
      )}

      {searchError && (
        <p className="text-sm text-destructive text-center py-2">
          {(searchError as Error).message}
        </p>
      )}

      {availableNumbers && availableNumbers.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No numbers found in your area. Please contact support.
        </p>
      )}

      {availableNumbers && availableNumbers.length > 0 && (
        <div className="space-y-2">
          {availableNumbers.map((n) => (
            <div
              key={n.phoneNumber}
              className="flex items-center justify-between rounded-lg border bg-white p-3"
            >
              <div>
                <p className="font-mono font-medium">{n.phoneNumber}</p>
                {n.locality && (
                  <p className="text-xs text-muted-foreground">
                    {n.locality}
                    {n.region ? `, ${n.region}` : ""}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => purchaseMutation.mutate(n.phoneNumber)}
                disabled={purchaseMutation.isPending}
              >
                {purchaseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Phone className="h-4 w-4 mr-1" /> Select
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {purchaseMutation.isError && (
        <p className="text-xs text-destructive text-center">
          {purchaseMutation.error.message}
        </p>
      )}
    </div>
  );
}

function MediaSettings({ tenant, mutation }: { tenant: TenantData; mutation: SettingsMutation }) {
  const [form, setForm] = useState({
    heroMediaUrl: tenant?.heroMediaUrl || "",
    heroMediaType: tenant?.heroMediaType || "image",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setForm({ heroMediaUrl: data.data.url, heroMediaType: data.data.mediaType });
      } else {
        setUploadError(data.error || "Upload failed");
      }
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearMedia = () => {
    setForm({ ...form, heroMediaUrl: "" });
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" /> Shop Hero Media
        </CardTitle>
        <CardDescription>Upload a hero image or video for your public shop page</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        {!form.heroMediaUrl ? (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Click to upload a file</p>
              <p className="text-xs text-muted-foreground mt-1">
                JPEG, PNG, WebP, GIF, MP4, or WebM (max 20MB)
              </p>
              {uploading && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Or enter URL manually */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground">or enter a URL</span>
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={form.heroMediaType}
                onChange={(e) => setForm({ ...form, heroMediaType: e.target.value })}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-28"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              <Input
                placeholder="https://example.com/hero.jpg"
                value={form.heroMediaUrl}
                onChange={(e) => setForm({ ...form, heroMediaUrl: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        ) : (
          /* Preview with remove */
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <button
                onClick={clearMedia}
                className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
              >
                <X className="h-3 w-3" /> Remove
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border aspect-video bg-gray-100 relative">
              {form.heroMediaType === "video" ? (
                <video src={form.heroMediaUrl} controls muted className="w-full h-full object-cover" />
              ) : (
                <img src={form.heroMediaUrl} alt="Hero preview" className="w-full h-full object-cover" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{form.heroMediaUrl}</p>
          </div>
        )}

        {uploadError && (
          <p className="text-sm text-red-600">{uploadError}</p>
        )}

        <Button onClick={() => mutation.mutate({ section: "media", ...form })} disabled={mutation.isPending || uploading}>
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Media Settings
        </Button>
      </CardContent>
    </Card>
  );
}
