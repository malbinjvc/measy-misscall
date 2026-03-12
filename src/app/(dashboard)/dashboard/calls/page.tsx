"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PhoneCall, ChevronLeft, ChevronRight, MessageSquare, CheckCircle, RotateCcw } from "lucide-react";
import { formatDateTime, formatPhoneNumber } from "@/lib/utils";

interface CallSmsLog {
  id: string;
  body: string;
  status: string;
}

interface CallRecord {
  id: string;
  from: string;
  to: string;
  callerNumber: string;
  status: string;
  ivrResponse: string;
  createdAt: string;
  duration: number;
  callbackHandled: boolean;
  smsLogs: CallSmsLog[];
}

export default function CallsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [ivrFilter, setIvrFilter] = useState("");
  const queryClient = useQueryClient();
  // Cursor stack: tracks cursor IDs for each page visited (enables backward navigation)
  const cursorStackRef = useRef<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);

  const resetPagination = useCallback(() => {
    setPage(1);
    setCurrentCursor(null);
    cursorStackRef.current = [];
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["calls", page, statusFilter, ivrFilter, currentCursor],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (ivrFilter) params.set("ivrResponse", ivrFilter);
      if (currentCursor) params.set("cursor", currentCursor);
      const res = await fetch(`/api/calls?${params}`);
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

  const callbackMutation = useMutation({
    mutationFn: async ({ callId, callbackHandled }: { callId: string; callbackHandled: boolean }) => {
      const res = await fetch("/api/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, callbackHandled }),
      });
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calls"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  return (
    <div>
      <PageHeader title="Calls" description="View all incoming call records" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPagination(); }}>
          <option value="">All Statuses</option>
          <option value="MISSED">Missed</option>
          <option value="ANSWERED">Answered</option>
          <option value="NO_ANSWER">No Answer</option>
          <option value="BUSY">Busy</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Select value={ivrFilter} onChange={(e) => { setIvrFilter(e.target.value); resetPagination(); }}>
          <option value="">All IVR Responses</option>
          <option value="CALLBACK">Callback</option>
          <option value="BOOKING_LINK">Booking Link</option>
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((call: CallRecord) => {
                  const isUnhandledCallback = call.ivrResponse === "CALLBACK" && !call.callbackHandled;
                  const latestSms = call.smsLogs?.length ? call.smsLogs[call.smsLogs.length - 1] : null;
                  return (
                    <React.Fragment key={call.id}>
                      <TableRow className={isUnhandledCallback ? "bg-red-50 border-l-4 border-l-red-500" : ""}>
                        <TableCell className="text-sm">{formatDateTime(call.createdAt)}</TableCell>
                        <TableCell className="font-medium">{formatPhoneNumber(call.callerNumber)}</TableCell>
                        <TableCell><StatusBadge status={call.status} /></TableCell>
                        <TableCell><StatusBadge status={call.ivrResponse} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{call.smsLogs?.length || 0}</TableCell>
                        <TableCell>
                          {call.ivrResponse === "CALLBACK" && (
                            call.callbackHandled ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => callbackMutation.mutate({ callId: call.id, callbackHandled: false })}
                                disabled={callbackMutation.isPending}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Reopen
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => callbackMutation.mutate({ callId: call.id, callbackHandled: true })}
                                disabled={callbackMutation.isPending}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" /> Mark Handled
                              </Button>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                      {latestSms && (
                        <TableRow key={`${call.id}-sms`} className={isUnhandledCallback ? "bg-red-50/50 border-l-4 border-l-red-500" : "bg-muted/30"}>
                          <TableCell colSpan={6} className="py-2 px-4">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Reply sent:</span>{" "}
                                {latestSms.body}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {(data.hasMore || page > 1) && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {page}{data.total ? ` of ${data.totalPages} (${data.total} total)` : ""}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={goPrev} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={goNext} disabled={!data.hasMore}>
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
