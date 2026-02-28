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
import { PhoneCall, ChevronLeft, ChevronRight, MessageSquare, CheckCircle, RotateCcw } from "lucide-react";
import { formatDateTime, formatPhoneNumber } from "@/lib/utils";

export default function CallsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [ivrFilter, setIvrFilter] = useState("");
  const queryClient = useQueryClient();

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

  const callbackMutation = useMutation({
    mutationFn: async ({ callId, callbackHandled }: { callId: string; callbackHandled: boolean }) => {
      const res = await fetch("/api/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, callbackHandled }),
      });
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
                {data.data.map((call: any) => {
                  const isUnhandledCallback = call.ivrResponse === "CALLBACK" && !call.callbackHandled;
                  const latestSms = call.smsLogs?.length ? call.smsLogs[call.smsLogs.length - 1] : null;
                  return (
                    <>
                      <TableRow key={call.id} className={isUnhandledCallback ? "bg-red-50 border-l-4 border-l-red-500" : ""}>
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
                    </>
                  );
                })}
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
