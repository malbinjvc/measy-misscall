"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingPage } from "@/components/shared/loading";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Send, Loader2, Users, CheckCircle2, XCircle, Clock,
  ChevronLeft, ChevronRight, Trash2, AlertTriangle,
} from "lucide-react";
import { formatDate, formatPhoneNumber } from "@/lib/utils";

interface CampaignDetail {
  campaign: {
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
  };
  recipients: {
    id: string;
    customerName: string | null;
    phone: string;
    status: string;
    errorMessage: string | null;
    sentAt: string | null;
  }[];
  recipientTotal: number;
  recipientPage: number;
  recipientTotalPages: number;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [recipientPage, setRecipientPage] = useState(1);
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: CampaignDetail }>({
    queryKey: ["campaign-detail", id, recipientPage],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}?page=${recipientPage}&pageSize=20`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    staleTime: 10000,
  });

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

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send");
      return json;
    },
    onSuccess: () => {
      setShowConfirmSend(false);
      queryClient.invalidateQueries({ queryKey: ["campaign-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      router.push("/dashboard/campaigns");
    },
  });

  if (isLoading) return <LoadingPage />;

  const detail = data?.data;
  if (!detail) {
    return (
      <div>
        <PageHeader title="Campaign Not Found" backHref="/dashboard/campaigns" />
        <p className="text-muted-foreground">This campaign does not exist.</p>
      </div>
    );
  }

  const { campaign, recipients, recipientTotal, recipientTotalPages } = detail;
  const isDraft = campaign.status === "DRAFT";
  const isSending = campaign.status === "SENDING";

  const businessName = tenantData?.name || "Your Business";
  const slug = tenantData?.slug || "your-shop";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yoursite.com";
  const bookingUrl = `${appUrl}/shop/${slug}`;
  const fullMessage = `${businessName}: ${campaign.message}\n\nBook now: ${bookingUrl}\nReply STOP to opt out.`;
  const estimatedCost = (campaign.recipientCount * 0.035).toFixed(2); // estimate; actual rate from PlatformSettings

  return (
    <div>
      <PageHeader
        title={campaign.name}
        backHref="/dashboard/campaigns"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{campaign.recipientCount}</p>
              <p className="text-xs text-muted-foreground">Recipients</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{campaign.sentCount}</p>
              <p className="text-xs text-muted-foreground">Sent</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{campaign.failedCount}</p>
              <p className="text-xs text-muted-foreground">Failed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <StatusBadge status={campaign.status} />
              <p className="text-xs text-muted-foreground mt-1">
                {campaign.sentAt ? `Sent ${formatDate(campaign.sentAt)}` : `Created ${formatDate(campaign.createdAt)}`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        {isDraft && (
          <Button onClick={() => setShowConfirmSend(true)} disabled={campaign.recipientCount === 0}>
            <Send className="h-4 w-4 mr-2" />
            Send Campaign
          </Button>
        )}
        {isSending && (
          <Button disabled>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </Button>
        )}
        {isDraft && (
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setShowConfirmDelete(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        )}
      </div>

      {/* SMS Preview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">SMS Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border bg-muted/30 p-4">
            <p className="text-sm whitespace-pre-wrap">{fullMessage}</p>
          </div>
        </CardContent>
      </Card>

      {/* Recipients table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients ({recipientTotal})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No recipients
                  </TableCell>
                </TableRow>
              ) : (
                recipients.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.customerName || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{formatPhoneNumber(r.phone)}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>{r.sentAt ? formatDate(r.sentAt) : "—"}</TableCell>
                    <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                      {r.errorMessage || ""}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {recipientTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={recipientPage <= 1}
            onClick={() => setRecipientPage(recipientPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {recipientPage} of {recipientTotalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={recipientPage >= recipientTotalPages}
            onClick={() => setRecipientPage(recipientPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Send confirmation dialog */}
      {showConfirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirmSend(false)} />
          <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Send Campaign?</h3>
            <p className="text-sm text-muted-foreground">
              This will send <span className="font-medium text-foreground">{campaign.recipientCount}</span> SMS messages.
              Estimated cost: <span className="font-medium text-foreground">${estimatedCost} CAD</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              This action cannot be undone.
            </p>
            {sendMutation.isError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{sendMutation.error.message}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfirmSend(false)}>Cancel</Button>
              <Button
                onClick={() => sendMutation.mutate()}
                disabled={sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {sendMutation.isPending ? "Sending..." : "Send Now"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirmDelete(false)} />
          <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Delete Campaign?</h3>
            <p className="text-sm text-muted-foreground">
              This will permanently delete this campaign and all its recipient data.
            </p>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive">{deleteMutation.error.message}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowConfirmDelete(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
