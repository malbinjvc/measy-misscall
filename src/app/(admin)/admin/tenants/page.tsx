"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function AdminTenantsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenants", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/tenants?${params}`);
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; status?: string; assignedTwilioNumber?: string }) => {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-tenants"] }),
  });

  return (
    <div>
      <PageHeader title="Tenants" description="Manage all business tenants" />
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="ONBOARDING">Onboarding</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DISABLED">Disabled</option>
        </Select>
      </div>

      {isLoading ? (
        <LoadingTable />
      ) : !data?.data?.length ? (
        <EmptyState icon={<Building2 className="h-12 w-12" />} title="No tenants" description="Tenants will appear here when they register." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Business</TableHead>
                  <TableHead>Business Phone</TableHead>
                  <TableHead>Assigned Twilio #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((tenant: any) => (
                  <TenantRow key={tenant.id} tenant={tenant} updateMutation={updateMutation} />
                ))}
              </TableBody>
            </Table>
          </div>
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {data.page} of {data.totalPages} ({data.total} total)</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= data.totalPages}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TenantRow({ tenant, updateMutation }: { tenant: any; updateMutation: any }) {
  const [editing, setEditing] = useState(false);
  const [twilioNumber, setTwilioNumber] = useState(tenant.assignedTwilioNumber || "");

  function saveTwilioNumber() {
    updateMutation.mutate({ id: tenant.id, assignedTwilioNumber: twilioNumber });
    setEditing(false);
  }

  function cancelEdit() {
    setTwilioNumber(tenant.assignedTwilioNumber || "");
    setEditing(false);
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{tenant.name}</TableCell>
      <TableCell className="text-sm font-mono">{tenant.businessPhoneNumber || "—"}</TableCell>
      <TableCell>
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-7 w-36 text-xs font-mono"
              value={twilioNumber}
              onChange={(e) => setTwilioNumber(e.target.value)}
              placeholder="+1..."
            />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveTwilioNumber}>
              <Check className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <span
            className="text-sm font-mono cursor-pointer hover:text-primary"
            onClick={() => setEditing(true)}
          >
            {tenant.assignedTwilioNumber || "Click to assign"}
          </span>
        )}
      </TableCell>
      <TableCell><StatusBadge status={tenant.status} /></TableCell>
      <TableCell className="text-sm">{tenant.subscription?.plan?.name || "None"}</TableCell>
      <TableCell className="text-sm">{tenant._count?.calls || 0}</TableCell>
      <TableCell className="text-sm">{formatDate(tenant.createdAt)}</TableCell>
      <TableCell>
        <Select className="w-32 h-8 text-xs" value={tenant.status} onChange={(e) => updateMutation.mutate({ id: tenant.id, status: e.target.value })}>
          <option value="ONBOARDING">Onboarding</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="DISABLED">Disabled</option>
        </Select>
      </TableCell>
    </TableRow>
  );
}
