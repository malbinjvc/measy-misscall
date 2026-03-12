"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Mail, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateTime, formatPhoneNumber } from "@/lib/utils";

interface SmsLog {
  id: string;
  to: string;
  toNumber: string;
  body: string;
  status: string;
  createdAt: string;
  direction: string;
  from: string;
  type: string;
}

export default function SmsLogsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  // Cursor stack: tracks cursor IDs for each page visited (enables backward navigation)
  const cursorStackRef = useRef<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  const resetPagination = useCallback(() => {
    setPage(1);
    setCurrentCursor(null);
    cursorStackRef.current = [];
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["sms-logs", page, statusFilter, currentCursor],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (currentCursor) params.set("cursor", currentCursor);
      const res = await fetch(`/api/sms?${params}`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    staleTime: 60000,
  });

  const goNext = useCallback(() => {
    if (!data?.nextCursor) return;
    cursorStackRef.current.push(data.nextCursor);
    setCurrentCursor(data.nextCursor);
    setPage((p) => p + 1);
  }, [data?.nextCursor]);

  const goPrev = useCallback(() => {
    if (page <= 1) return;
    cursorStackRef.current.pop();
    const prevCursor = cursorStackRef.current.length > 0
      ? cursorStackRef.current[cursorStackRef.current.length - 1]
      : null;
    setCurrentCursor(prevCursor);
    setPage((p) => p - 1);
  }, [page]);

  return (
    <div>
      <PageHeader title="SMS Logs" description="Track all SMS messages sent to customers" />
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPagination(); }}>
          <option value="">All Statuses</option>
          <option value="QUEUED">Queued</option>
          <option value="SENT">Sent</option>
          <option value="DELIVERED">Delivered</option>
          <option value="FAILED">Failed</option>
          <option value="UNDELIVERED">Undelivered</option>
        </Select>
      </div>

      {isLoading ? (
        <LoadingTable />
      ) : !data?.data?.length ? (
        <EmptyState icon={<Mail className="h-12 w-12" />} title="No SMS logs" description="SMS messages will appear here when sent to customers." />
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((sms: SmsLog) => (
                  <TableRow key={sms.id}>
                    <TableCell className="text-sm">{formatDateTime(sms.createdAt)}</TableCell>
                    <TableCell className="text-sm">{formatPhoneNumber(sms.toNumber)}</TableCell>
                    <TableCell className="text-sm">{sms.type.replace(/_/g, " ")}</TableCell>
                    <TableCell><StatusBadge status={sms.status} /></TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{sms.body}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {(data.hasMore || page > 1) && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page}{data.total ? ` of ${data.totalPages} (${data.total} total)` : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={page <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={goNext} disabled={!data.hasMore}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
