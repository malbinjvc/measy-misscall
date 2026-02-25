"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PhoneCall, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime, formatPhoneNumber } from "@/lib/utils";

export default function CallsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [ivrFilter, setIvrFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["calls", page, statusFilter, ivrFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (ivrFilter) params.set("ivrResponse", ivrFilter);
      const res = await fetch(`/api/calls?${params}`);
      return res.json();
    },
  });

  return (
    <div>
      <PageHeader title="Calls" description="View all incoming call records" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="MISSED">Missed</option>
          <option value="ANSWERED">Answered</option>
          <option value="NO_ANSWER">No Answer</option>
          <option value="BUSY">Busy</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Select value={ivrFilter} onChange={(e) => { setIvrFilter(e.target.value); setPage(1); }}>
          <option value="">All IVR Responses</option>
          <option value="CALLBACK">Callback</option>
          <option value="COMPLAINT">Complaint</option>
          <option value="NO_RESPONSE">No Response</option>
          <option value="INVALID">Invalid</option>
        </Select>
      </div>

      {isLoading ? (
        <LoadingTable />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={<PhoneCall className="h-12 w-12" />}
          title="No calls yet"
          description="Calls will appear here when customers call your Twilio number."
        />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IVR Response</TableHead>
                  <TableHead>SMS Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((call: any) => (
                  <TableRow key={call.id}>
                    <TableCell className="text-sm">{formatDateTime(call.createdAt)}</TableCell>
                    <TableCell className="font-medium">{formatPhoneNumber(call.callerNumber)}</TableCell>
                    <TableCell><StatusBadge status={call.status} /></TableCell>
                    <TableCell><StatusBadge status={call.ivrResponse} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{call.smsLogs?.length || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages} ({data.total} total)
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= data.totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
