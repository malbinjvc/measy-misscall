"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, X, Loader2, Megaphone, ChevronLeft, ChevronRight, Users, AlertTriangle, Search,
} from "lucide-react";
import { formatDate, formatPhoneNumber } from "@/lib/utils";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
}

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", page],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?page=${page}&pageSize=20`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    staleTime: 30000,
  });

  const campaigns: Campaign[] = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Send SMS campaigns to customers who opted in"
        action={{
          label: "New Campaign",
          onClick: () => setShowCreateDialog(true),
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {isLoading ? (
        <LoadingTable />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-10 w-10" />}
          title="No campaigns yet"
          description="Create your first SMS campaign to reach customers who opted in."
          action={
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> New Campaign
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Recipients</TableHead>
                    <TableHead className="text-center">Sent</TableHead>
                    <TableHead className="text-center">Failed</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                      <TableCell className="text-center">{c.recipientCount}</TableCell>
                      <TableCell className="text-center">{c.sentCount}</TableCell>
                      <TableCell className="text-center">{c.failedCount}</TableCell>
                      <TableCell>{formatDate(c.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {showCreateDialog && (
        <CreateCampaignDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={(id) => {
            setShowCreateDialog(false);
            queryClient.invalidateQueries({ queryKey: ["campaigns"] });
            router.push(`/dashboard/campaigns/${id}`);
          }}
        />
      )}
    </div>
  );
}

interface EligibleCustomer {
  id: string;
  name: string;
  phone: string;
}

function CreateCampaignDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customerSearch, setCustomerSearch] = useState("");

  const { data: tenantData } = useQuery({
    queryKey: ["tenant"],
    queryFn: async () => {
      const res = await fetch("/api/tenant");
      if (!res.ok) throw new Error("Request failed");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60000,
  });

  const { data: recipientData } = useQuery({
    queryKey: ["campaign-recipients", customerSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "200" });
      if (customerSearch) params.set("search", customerSearch);
      const res = await fetch(`/api/campaigns/recipients?${params}`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
  });

  const customers: EligibleCustomer[] = recipientData?.data || [];
  const totalEligible = recipientData?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; message: string; customerIds?: string[] }) => {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.fieldErrors) setFieldErrors(json.fieldErrors);
        throw new Error(json.error || "Failed to create campaign");
      }
      return json;
    },
    onSuccess: (data) => {
      onCreated(data.data.id);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const businessName = tenantData?.name || "Your Business";
  const slug = tenantData?.slug || "your-shop";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yoursite.com";
  const bookingUrl = `${appUrl}/shop/${slug}`;

  const recipientCount = sendToAll ? totalEligible : selectedIds.size;

  const previewMessage = message
    ? `${businessName}: ${message}\n\nBook now: ${bookingUrl}\nReply STOP to opt out.`
    : "";

  function toggleCustomer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === customers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Create Campaign</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Campaign name */}
          <div>
            <Label>Campaign Name</Label>
            <Input
              className={`mt-1 ${fieldErrors.name ? "border-destructive" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spring promotion"
              maxLength={100}
            />
            {fieldErrors.name && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>
            )}
          </div>

          {/* Message */}
          <div>
            <Label>Campaign Message</Label>
            <Textarea
              className={`mt-1 ${fieldErrors.message ? "border-destructive" : ""}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="We have a special offer this week! Get 20% off all services when you book online."
              rows={4}
              maxLength={320}
            />
            <div className="flex justify-between mt-1">
              {fieldErrors.message ? (
                <p className="text-xs text-destructive">{fieldErrors.message}</p>
              ) : (
                <span />
              )}
              <span className={`text-xs ${message.length > 300 ? "text-amber-600" : "text-muted-foreground"}`}>
                {message.length}/320
              </span>
            </div>
          </div>

          {/* SMS Preview */}
          {previewMessage && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <Label className="text-sm font-medium">SMS Preview</Label>
              <div className="rounded-md bg-background border p-3">
                <p className="text-sm whitespace-pre-wrap">{previewMessage}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                This is exactly how the SMS will appear to your customers.
              </p>
            </div>
          )}

          <hr />

          {/* Recipients selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Recipients</Label>

            {totalEligible === 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-700">
                  No customers have opted in to receive SMS messages yet. Customers can opt in when booking an appointment.
                </p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Select all / count header */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sendToAll || (selectedIds.size === customers.length && customers.length > 0)}
                      onChange={() => {
                        if (sendToAll) {
                          // Uncheck "all" → switch to select mode with none selected
                          setSendToAll(false);
                          setSelectedIds(new Set());
                        } else if (selectedIds.size === customers.length && customers.length > 0) {
                          // All individually checked → deselect all
                          setSelectedIds(new Set());
                        } else {
                          // Select all
                          setSendToAll(true);
                          setSelectedIds(new Set(customers.map((c) => c.id)));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                    <span className="text-sm font-medium">
                      Select All ({totalEligible})
                    </span>
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {sendToAll ? totalEligible : selectedIds.size} selected
                  </span>
                </div>

                {/* Customer list */}
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {customers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {customerSearch ? "No matching customers" : "No eligible customers"}
                    </p>
                  ) : (
                    customers.map((c) => {
                      const isChecked = sendToAll || selectedIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                            isChecked ? "bg-primary/5" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (sendToAll) {
                                // Switching from "all" to individual selection — select all except this one
                                const allExceptThis = new Set(customers.map((cu) => cu.id));
                                allExceptThis.delete(c.id);
                                setSendToAll(false);
                                setSelectedIds(allExceptThis);
                              } else {
                                toggleCustomer(c.id);
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 accent-primary shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{formatPhoneNumber(c.phone)}</p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Recipient summary */}
                <div className={`rounded-lg border p-3 flex items-center gap-3 ${
                  recipientCount > 0 ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
                }`}>
                  <Users className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">
                    {recipientCount} recipient{recipientCount !== 1 ? "s" : ""} will receive this campaign
                  </p>
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              setError("");
              setFieldErrors({});
              createMutation.mutate({
                name,
                message,
                ...(!sendToAll && selectedIds.size > 0 && {
                  customerIds: Array.from(selectedIds),
                }),
              });
            }}
            disabled={!name || !message || createMutation.isPending || recipientCount === 0}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Megaphone className="h-4 w-4 mr-2" />
            )}
            Create Campaign
          </Button>
        </div>
      </div>
    </div>
  );
}
