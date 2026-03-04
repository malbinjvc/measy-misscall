"use client";

import { useQuery, useMutation, useQueryClient, UseMutationResult, QueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable } from "@/components/shared/loading";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar, CalendarSync, DollarSign, Clock, CheckCircle, Eye, Plus, Minus, X,
  ChevronLeft, ChevronRight, List, AlertTriangle, XCircle, UserX, Ban,
} from "lucide-react";
import {
  formatDate, formatDateUTC, formatCurrency, formatPhoneNumber, generateTimeSlots,
  timeStringToMinutes,
} from "@/lib/utils";
import { computeAppointmentPrice, computeMultiItemPrice, computeMultiItemDuration } from "@/lib/appointment-helpers";

// ─── Types ────────────────────────────────────────────

type ViewMode = "list" | "calendar";

interface SubOption {
  id: string;
  name: string;
  price: number | null;
}

interface ServiceOption {
  id: string;
  name: string;
  description?: string | null;
  duration?: number | null;
  price: number | null;
  minQuantity: number;
  maxQuantity: number;
  defaultQuantity: number;
  subOptions: SubOption[];
}

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number | null;
  options: ServiceOption[];
}

interface AppointmentItem {
  id: string;
  serviceId: string;
  service: { id: string; name: string; price: number | null; duration: number };
  serviceOptionId?: string | null;
  serviceOption: {
    id: string;
    name: string;
    price: number | null;
    duration?: number | null;
    subOptions: SubOption[];
  } | null;
  quantity: number;
  selectedSubOptions: string[];
  sortOrder: number;
}

interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  quantity: number;
  selectedSubOptions: string[];
  service: { id: string; name: string; price: number | null; duration: number };
  serviceOption?: {
    id: string;
    name: string;
    price: number | null;
    duration?: number | null;
    subOptions: SubOption[];
  } | null;
  items?: AppointmentItem[];
  totalPrice: number;
  resolvedSubOptions: SubOption[];
  vehicleYear?: string | null;
  vehicleType?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  appointmentPreference?: string | null;
}

interface BusinessHour {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface AppointmentListResponse {
  data: Appointment[];
  page: number;
  totalPages: number;
  total: number;
  stats?: {
    totalAppointments: number;
    totalRevenue: number;
    statusCounts?: Record<string, number>;
  };
}

interface CalendarResponse {
  data: Record<string, Appointment[]>;
  businessHours?: BusinessHour[];
}

type AppointmentUpdateMutation = UseMutationResult<
  unknown,
  Error,
  { id: string; status?: string; notes?: string; date?: string; startTime?: string }
>;

// ─── Constants ────────────────────────────────────────

const STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const STATUS_LABELS: Record<string, string> = { PENDING: "PROCESSING" };
const statusLabel = (s: string) => (STATUS_LABELS[s] || s).replace(/_/g, " ");


const DAY_MAP: Record<string, number> = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};

const STATUS_DOT_COLORS: Record<string, string> = {
  PENDING: "bg-green-500",
  CONFIRMED: "bg-blue-500",
  COMPLETED: "bg-[#6040E0]",
  CANCELLED: "bg-red-400",
  NO_SHOW: "bg-gray-400",
};


function computeAvailableSlots(
  bh: BusinessHour | undefined,
  appointments: Appointment[]
): { total: number; occupied: number; available: number } | null {
  if (!bh || !bh.isOpen) return null;
  const openMin = timeStringToMinutes(bh.openTime);
  const closeMin = timeStringToMinutes(bh.closeTime);
  const total = generateTimeSlots(bh.openTime, bh.closeTime, 30).length;
  const occupiedSet = new Set<number>();
  for (const apt of appointments) {
    if (apt.status === "CANCELLED" || apt.status === "NO_SHOW") continue;
    const startMin = timeStringToMinutes(apt.startTime);
    const endMin = timeStringToMinutes(apt.endTime);
    for (let m = startMin; m < endMin; m += 30) {
      if (m >= openMin && m < closeMin) occupiedSet.add(m);
    }
  }
  const available = Math.max(0, total - occupiedSet.size);
  return { total, occupied: occupiedSet.size, available };
}

function computeConflicts(
  bh: BusinessHour | undefined,
  appointments: Appointment[]
): number {
  if (!bh || !bh.isOpen) return 0;
  const openMin = timeStringToMinutes(bh.openTime);
  const closeMin = timeStringToMinutes(bh.closeTime);
  let count = 0;
  for (const apt of appointments) {
    if (apt.status === "CANCELLED" || apt.status === "NO_SHOW") continue;
    const startMin = timeStringToMinutes(apt.startTime);
    const endMin = timeStringToMinutes(apt.endTime);
    if (startMin < openMin || endMin > closeMin) count++;
  }
  return count;
}

// ─── Page ─────────────────────────────────────────────

export default function AppointmentsPage() {
  const [activeView, setActiveView] = useState<ViewMode>("calendar");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createPrefilledDate, setCreatePrefilledDate] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // ── Data fetching ──

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["appointments", page, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: calendarData } = useQuery<CalendarResponse>({
    queryKey: ["appointments-calendar", calendarMonth],
    queryFn: async () => {
      const res = await fetch(`/api/appointments?mode=calendar&month=${calendarMonth}`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    enabled: activeView === "calendar",
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: async (body: { id: string; status?: string; notes?: string; date?: string; startTime?: string }) => {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
    },
  });

  // ── Stats from list data ──

  const stats = listData?.stats;

  // ── Render ──

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Manage customer appointments"
        action={{
          label: "New Appointment",
          onClick: () => { setCreatePrefilledDate(null); setShowCreateDialog(true); },
          icon: <Plus className="h-4 w-4 mr-2" />,
        }}
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${statusFilter === "" ? "ring-2 ring-primary" : ""}`}
            onClick={() => { setStatusFilter(""); setPage(1); setActiveView("list"); }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-xl font-bold">{stats.totalAppointments}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
            </CardContent>
          </Card>
          {([
            { status: "PENDING", label: "Processing", icon: Clock, bg: "bg-green-100", text: "text-green-600" },
            { status: "CONFIRMED", label: "Confirmed", icon: CheckCircle, bg: "bg-purple-100", text: "text-purple-600" },
            { status: "COMPLETED", label: "Completed", icon: CheckCircle, bg: "bg-[#6040E0]/15", text: "text-[#6040E0]" },
            { status: "CANCELLED", label: "Cancelled", icon: XCircle, bg: "bg-red-100", text: "text-red-600" },
            { status: "NO_SHOW", label: "No Show", icon: UserX, bg: "bg-gray-100", text: "text-gray-600" },
          ] as const).map(({ status: s, label, icon: Icon, bg, text }) => (
            <Card
              key={s}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${statusFilter === s ? "ring-2 ring-primary" : ""}`}
              onClick={() => { setStatusFilter(s); setPage(1); setActiveView("list"); }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 ${bg} rounded-lg`}>
                  <Icon className={`h-5 w-5 ${text}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold">{stats.statusCounts?.[s] || 0}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Toggle + Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            variant={activeView === "calendar" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("calendar")}
          >
            <Calendar className="h-4 w-4 mr-1" /> Calendar
          </Button>
          <Button
            variant={activeView === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveView("list")}
          >
            <List className="h-4 w-4 mr-1" /> List
          </Button>
        </div>
        <Select
          className="w-40"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </Select>
      </div>

      {/* Views */}
      {activeView === "list" ? (
        <ListView
          data={listData}
          isLoading={listLoading}
          page={page}
          setPage={setPage}
          onSelect={setSelectedAppointment}
          updateMutation={updateMutation}
          queryClient={queryClient}
        />
      ) : (
        <CalendarView
          calendarMonth={calendarMonth}
          setCalendarMonth={setCalendarMonth}
          calendarData={calendarData}
          onAddAppointment={(date) => {
            setCreatePrefilledDate(date);
            setShowCreateDialog(true);
          }}
        />
      )}

      {/* Detail Dialog */}
      {selectedAppointment && (
        <AppointmentDetailDialog
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onUpdate={(id, data) => {
            updateMutation.mutate({ id, ...data }, {
              onSuccess: () => setSelectedAppointment(null),
            });
          }}
          onReschedule={(apt) => {
            setSelectedAppointment(null);
            setRescheduleAppointment(apt);
          }}
        />
      )}

      {/* Reschedule Dialog */}
      {rescheduleAppointment && (
        <RescheduleDialog
          appointment={rescheduleAppointment}
          onClose={() => setRescheduleAppointment(null)}
          onRescheduled={() => {
            setRescheduleAppointment(null);
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
          }}
        />
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <CreateAppointmentDialog
          prefilledDate={createPrefilledDate}
          existingAppointments={
            createPrefilledDate && calendarData?.data
              ? calendarData.data[createPrefilledDate] || []
              : []
          }
          onSelectAppointment={(apt) => {
            setShowCreateDialog(false);
            setSelectedAppointment(apt);
          }}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => {
            setShowCreateDialog(false);
            queryClient.invalidateQueries({ queryKey: ["appointments"] });
            queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
          }}
        />
      )}
    </div>
  );
}

// ─── List View ────────────────────────────────────────

function ListView({
  data, isLoading, page, setPage, onSelect, updateMutation, queryClient,
}: {
  data: AppointmentListResponse | undefined;
  isLoading: boolean;
  page: number;
  setPage: (p: number) => void;
  onSelect: (a: Appointment) => void;
  updateMutation: AppointmentUpdateMutation;
  queryClient: QueryClient;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const allIds: string[] = data?.data?.map((a: Appointment) => a.id) || [];
  const allSelected = allIds.length > 0 && allIds.every((id: string) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }

  async function handleBulkUpdate() {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkUpdating(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: bulkStatus }),
      });
      if (!res.ok) throw new Error("Request failed");
      const result = await res.json();
      if (result.success) {
        setSelectedIds(new Set());
        setBulkStatus("");
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        queryClient.invalidateQueries({ queryKey: ["appointments-calendar"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      }
    } catch {
      // silent
    } finally {
      setBulkUpdating(false);
    }
  }

  const hasVehicleData = data?.data?.some(
    (a: Appointment) => a.vehicleYear || a.vehicleMake || a.vehicleModel
  ) ?? false;

  if (isLoading) return <LoadingTable />;

  if (!data?.data?.length) {
    return (
      <EmptyState
        icon={<Calendar className="h-12 w-12" />}
        title="No appointments yet"
        description="Appointments will appear here when customers book through your shop page."
      />
    );
  }

  return (
    <>
      {/* Bulk actions bar */}
      {someSelected && (
        <div className="flex items-center gap-3 mb-3 p-3 rounded-lg border bg-muted/50">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Select
            className="w-40 h-8 text-xs"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
          >
            <option value="">Change status to...</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </Select>
          <Button
            size="sm"
            onClick={handleBulkUpdate}
            disabled={!bulkStatus || bulkUpdating}
          >
            {bulkUpdating ? "Updating..." : "Apply"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedIds(new Set()); setBulkStatus(""); }}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="accent-primary h-4 w-4"
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Service / Option</TableHead>
              {hasVehicleData && <TableHead>Vehicle</TableHead>}
              <TableHead>Qty</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((apt: Appointment) => (
              <TableRow
                key={apt.id}
                className={`cursor-pointer ${selectedIds.has(apt.id) ? "bg-primary/5" : ""}`}
                onClick={() => onSelect(apt)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(apt.id)}
                    onChange={() => toggleSelect(apt.id)}
                    className="accent-primary h-4 w-4"
                  />
                </TableCell>
                <TableCell className="text-sm">{formatDateUTC(apt.date)}</TableCell>
                <TableCell className="text-sm">{apt.startTime} — {apt.endTime}</TableCell>
                <TableCell className="font-medium">{apt.customerName}</TableCell>
                <TableCell className="text-sm">
                  {apt.items && apt.items.length > 1 ? (
                    <div>
                      <div>{apt.items[0].service?.name}</div>
                      {apt.items[0].serviceOption && (
                        <div className="text-xs text-muted-foreground">{apt.items[0].serviceOption.name}</div>
                      )}
                      <div className="text-xs text-primary font-medium">+{apt.items.length - 1} more</div>
                    </div>
                  ) : (
                    <div>
                      <div>{apt.service?.name}</div>
                      {apt.serviceOption && (
                        <div className="text-xs text-muted-foreground">{apt.serviceOption.name}</div>
                      )}
                    </div>
                  )}
                </TableCell>
                {hasVehicleData && (
                  <TableCell className="text-sm">
                    {(apt.vehicleYear || apt.vehicleMake || apt.vehicleModel)
                      ? [apt.vehicleYear, apt.vehicleMake, apt.vehicleModel].filter(Boolean).join(" ")
                      : ""}
                  </TableCell>
                )}
                <TableCell className="text-sm">{apt.quantity > 1 ? apt.quantity : ""}</TableCell>
                <TableCell className="text-sm font-medium">
                  {formatCurrency(apt.totalPrice)}
                </TableCell>
                <TableCell><StatusBadge status={apt.status} /></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onSelect(apt)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Select
                      className="w-32 h-8 text-xs"
                      value={apt.status}
                      onChange={(e) => updateMutation.mutate({ id: apt.id, status: e.target.value })}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{statusLabel(s)}</option>
                      ))}
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
  );
}

// ─── Calendar View ────────────────────────────────────

function CalendarView({
  calendarMonth, setCalendarMonth, calendarData,
  onAddAppointment,
}: {
  calendarMonth: string;
  setCalendarMonth: (m: string) => void;
  calendarData: CalendarResponse | undefined;
  onAddAppointment: (date: string) => void;
}) {
  const [year, month] = calendarMonth.split("-").map(Number);

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDayOfWeek = firstDay.getDay();

  const businessHoursMap = useMemo(() => {
    const map: Record<number, BusinessHour> = {};
    if (calendarData?.businessHours) {
      for (const bh of calendarData.businessHours) {
        const dayNum = DAY_MAP[bh.day];
        if (dayNum !== undefined) map[dayNum] = bh;
      }
    }
    return map;
  }, [calendarData?.businessHours]);

  const grouped: Record<string, Appointment[]> = calendarData?.data || {};

  function navigateMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setCalendarMonth(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }

  const monthLabel = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <Button variant="outline" size="sm" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} className="p-2 min-h-[80px] border-b border-r bg-muted/20" />;
            }

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayAppts = grouped[dateStr] || [];
            const dayOfWeek = new Date(year, month - 1, day).getDay();
            const bh = businessHoursMap[dayOfWeek];
            const isClosed = bh ? !bh.isOpen : false;
            const slotInfo = computeAvailableSlots(bh, dayAppts);
            const conflicts = computeConflicts(bh, dayAppts);
            const isToday =
              new Date().getFullYear() === year &&
              new Date().getMonth() === month - 1 &&
              new Date().getDate() === day;

            return (
              <div
                key={dateStr}
                className={`p-2 min-h-[80px] border-b border-r transition-colors ${
                  isClosed ? "bg-muted/40 cursor-default" : "cursor-pointer hover:bg-muted/30"
                }`}
                onClick={() => {
                  if (!isClosed) onAddAppointment(dateStr);
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${
                      isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : ""
                    } ${isClosed ? "text-muted-foreground line-through" : ""}`}
                  >
                    {day}
                  </span>
                  {dayAppts.length > 3 && (
                    <span className="text-xs bg-muted rounded-full px-1.5">{dayAppts.length}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {dayAppts.slice(0, 3).map((apt: Appointment) => (
                    <span
                      key={apt.id}
                      className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[apt.status] || "bg-gray-300"}`}
                    />
                  ))}
                </div>
                {isClosed && (
                  <span className="text-[10px] text-muted-foreground">Closed</span>
                )}
                {slotInfo && (
                  <div className="mt-1">
                    <div className="w-full h-[2px] rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          slotInfo.total === 0 ? "bg-gray-300" :
                          (slotInfo.occupied / slotInfo.total) >= 0.8 ? "bg-red-500" :
                          (slotInfo.occupied / slotInfo.total) >= 0.5 ? "bg-yellow-500" :
                          "bg-green-500"
                        }`}
                        style={{ width: slotInfo.total > 0 ? `${(slotInfo.occupied / slotInfo.total) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className={`text-[10px] ${
                      slotInfo.available === 0 ? "text-red-500 font-medium" : "text-muted-foreground"
                    }`}>
                      {slotInfo.available === 0 ? "Full" : `${slotInfo.available} left`}
                    </span>
                  </div>
                )}
                {conflicts > 0 && (
                  <div className="flex items-center gap-0.5 mt-0.5">
                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                    <span className="text-[10px] text-orange-600 font-medium">
                      {conflicts} reschedule
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Appointment Detail Dialog ────────────────────────

function AppointmentDetailDialog({
  appointment, onClose, onUpdate, onReschedule,
}: {
  appointment: Appointment;
  onClose: () => void;
  onUpdate: (id: string, data: { status?: string; notes?: string }) => void;
  onReschedule: (apt: Appointment) => void;
}) {
  const [status, setStatus] = useState(appointment.status);
  const [notes, setNotes] = useState(appointment.notes || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Appointment Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Customer */}
          <div>
            <Label className="text-xs text-muted-foreground">Customer</Label>
            <p className="font-medium">{appointment.customerName}</p>
            <p className="text-sm text-muted-foreground">{formatPhoneNumber(appointment.customerPhone)}</p>
            {appointment.customerEmail && (
              <p className="text-sm text-muted-foreground">{appointment.customerEmail}</p>
            )}
          </div>

          {/* Services */}
          <div>
            <Label className="text-xs text-muted-foreground">
              {appointment.items && appointment.items.length > 1 ? "Services" : "Service"}
            </Label>
            {appointment.items && appointment.items.length > 0 ? (
              <div className="space-y-2 mt-1">
                {appointment.items.map((item, idx) => (
                  <div key={item.id} className={`${idx > 0 ? "pt-2 border-t" : ""}`}>
                    <p className="font-medium">{item.service?.name}</p>
                    {item.serviceOption && (
                      <p className="text-sm text-muted-foreground">{item.serviceOption.name}</p>
                    )}
                    {item.quantity > 1 && (
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    )}
                    {item.serviceOption?.subOptions && item.selectedSubOptions?.length > 0 && (
                      <ul className="text-sm mt-1">
                        {item.serviceOption.subOptions
                          .filter((s) => item.selectedSubOptions.includes(s.id))
                          .map((sub) => (
                            <li key={sub.id} className="flex justify-between text-xs">
                              <span>+ {sub.name}</span>
                              {sub.price != null && sub.price > 0 && (
                                <span className="text-muted-foreground">+{formatCurrency(sub.price)}</span>
                              )}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="font-medium">{appointment.service?.name}</p>
                {appointment.serviceOption && (
                  <p className="text-sm text-muted-foreground">{appointment.serviceOption.name}</p>
                )}
                {appointment.quantity > 1 && (
                  <p className="text-sm text-muted-foreground">Quantity: {appointment.quantity}</p>
                )}
              </>
            )}
          </div>

          {/* Sub-options (add-ons) — legacy single-item only */}
          {(!appointment.items || appointment.items.length === 0) && appointment.resolvedSubOptions?.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Add-ons</Label>
              <ul className="text-sm space-y-1">
                {appointment.resolvedSubOptions.map((sub) => (
                  <li key={sub.id} className="flex justify-between">
                    <span>{sub.name}</span>
                    {sub.price != null && sub.price > 0 && (
                      <span className="text-muted-foreground">+{formatCurrency(sub.price)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vehicle Info */}
          {(appointment.vehicleYear || appointment.vehicleMake || appointment.vehicleModel) && (
            <div>
              <Label className="text-xs text-muted-foreground">Vehicle</Label>
              <p className="font-medium">
                {[appointment.vehicleYear, appointment.vehicleMake, appointment.vehicleModel].filter(Boolean).join(" ")}
              </p>
              {appointment.vehicleType && (
                <p className="text-sm text-muted-foreground capitalize">{appointment.vehicleType}</p>
              )}
            </div>
          )}

          {/* Appointment Preference */}
          {appointment.appointmentPreference && (
            <div>
              <Label className="text-xs text-muted-foreground">Preference</Label>
              <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                appointment.appointmentPreference === "DROP_OFF"
                  ? "bg-blue-100 text-blue-700"
                  : appointment.appointmentPreference === "WAIT_FOR_IT"
                  ? "bg-green-100 text-green-700"
                  : "bg-purple-100 text-purple-700"
              }`}>
                {appointment.appointmentPreference === "DROP_OFF"
                  ? "Drop Off"
                  : appointment.appointmentPreference === "WAIT_FOR_IT"
                  ? "Wait"
                  : "Pick-up/Drop-off"}
              </span>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Date</Label>
              <p className="text-sm">{formatDateUTC(appointment.date)}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Time</Label>
              <p className="text-sm">{appointment.startTime} — {appointment.endTime}</p>
            </div>
          </div>

          {/* Total Price */}
          <div>
            <Label className="text-xs text-muted-foreground">Total Price</Label>
            <p className="text-lg font-bold">{formatCurrency(appointment.totalPrice)}</p>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              className="mt-1"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              className="mt-1"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-between gap-2 p-4 border-t">
          <div>
            {(appointment.status === "PENDING" || appointment.status === "CONFIRMED") && (
              <Button variant="outline" onClick={() => onReschedule(appointment)}>
                <CalendarSync className="h-4 w-4 mr-2" />
                Reschedule
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button
              onClick={() => onUpdate(appointment.id, { status, notes: notes || undefined })}
              disabled={status === appointment.status && notes === (appointment.notes || "")}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Reschedule Dialog ───────────────────────────────

function RescheduleDialog({
  appointment, onClose, onRescheduled,
}: {
  appointment: Appointment;
  onClose: () => void;
  onRescheduled: () => void;
}) {
  const currentDate = appointment.date.substring(0, 10);
  const [date, setDate] = useState(currentDate);
  const [startTime, setStartTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch business hours + appointments for the selected date's month
  const dateMonth = date ? date.substring(0, 7) : null;
  const { data: bhData } = useQuery<CalendarResponse>({
    queryKey: ["business-hours-for-reschedule", dateMonth],
    queryFn: async () => {
      const m = dateMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const res = await fetch(`/api/appointments?mode=calendar&month=${m}`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
  });

  const appointmentsForDate: Appointment[] = useMemo(() => {
    if (!date || !bhData?.data) return [];
    return (bhData.data[date] || []) as Appointment[];
  }, [date, bhData?.data]);

  // Time slots based on business hours
  const timeSlots = useMemo(() => {
    if (!date || !bhData?.businessHours) return [];
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const bh = bhData.businessHours.find((h: BusinessHour) => h.day === dayNames[dayOfWeek]);
    if (!bh || !bh.isOpen) return [];
    return generateTimeSlots(bh.openTime, bh.closeTime, 30);
  }, [date, bhData?.businessHours]);

  // Build occupied slot map — exclude current appointment (it's being moved)
  const occupiedSlotMap = useMemo(() => {
    const map = new Map<number, Appointment>();
    for (const apt of appointmentsForDate) {
      if (apt.id === appointment.id) continue;
      if (apt.status === "CANCELLED" || apt.status === "NO_SHOW") continue;
      const startMin = timeStringToMinutes(apt.startTime);
      const endMin = timeStringToMinutes(apt.endTime);
      for (let m = startMin; m < endMin; m += 30) {
        map.set(m, apt);
      }
    }
    return map;
  }, [appointmentsForDate, appointment.id]);

  // Service duration for overlap checking — use items when available
  const totalDuration = appointment.items && appointment.items.length > 0
    ? computeMultiItemDuration(appointment.items)
    : (appointment.serviceOption?.duration || appointment.service.duration) * (appointment.quantity || 1);
  const slotsNeeded = Math.ceil(totalDuration / 30);

  async function handleSubmit() {
    if (!date || !startTime) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id, date, startTime }),
      });
      if (!res.ok) throw new Error("Request failed");
      const result = await res.json();
      if (!result.success) {
        setError(result.error || "Failed to reschedule");
        return;
      }
      onRescheduled();
    } catch {
      setError("Failed to reschedule");
    } finally {
      setSubmitting(false);
    }
  }

  const isSameSlot = date === currentDate && startTime === appointment.startTime;
  const canSubmit = date && startTime && !submitting && !isSameSlot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Reschedule Appointment</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current appointment info */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">Current Schedule</p>
            <p className="text-sm font-medium">
              {appointment.customerName} — {appointment.items && appointment.items.length > 1
                ? `${appointment.items[0].service?.name} +${appointment.items.length - 1} more`
                : appointment.service?.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDateUTC(appointment.date)} at {appointment.startTime} — {appointment.endTime}
            </p>
          </div>

          {/* Date */}
          <div>
            <Label>New Date</Label>
            <Input
              className="mt-1"
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setStartTime(""); }}
            />
          </div>

          {/* Time slots — color-coded grid */}
          {date && timeSlots.length > 0 && (
            <div>
              <Label>New Time</Label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {timeSlots.map((slot) => {
                  const slotMin = timeStringToMinutes(slot);
                  const bookedApt = occupiedSlotMap.get(slotMin);

                  // Check if selecting this slot would overlap a booked slot
                  let wouldOverlap = false;
                  if (!bookedApt) {
                    for (let s = 0; s < slotsNeeded; s++) {
                      if (occupiedSlotMap.has(slotMin + s * 30)) {
                        wouldOverlap = true;
                        break;
                      }
                    }
                  }

                  if (bookedApt) {
                    const statusBg: Record<string, string> = {
                      CONFIRMED: "bg-blue-100 border-blue-400",
                      PENDING: "bg-green-100 border-green-400",
                      COMPLETED: "bg-[#6040E0]/15 border-[#6040E0]",
                    };
                    const style = statusBg[bookedApt.status] || "bg-gray-100 border-gray-400";
                    return (
                      <div
                        key={slot}
                        className={`rounded-md border px-2 py-1.5 text-left cursor-not-allowed ${style}`}
                      >
                        <p className="text-xs font-medium">{slot}</p>
                        <p className="text-[10px] truncate">{bookedApt.customerName}</p>
                      </div>
                    );
                  }

                  if (wouldOverlap) {
                    return (
                      <div
                        key={slot}
                        className="rounded-md border border-muted bg-muted px-2 py-1.5 text-left opacity-50 cursor-not-allowed"
                      >
                        <p className="text-xs font-medium text-muted-foreground">{slot}</p>
                        <p className="text-[10px] text-muted-foreground">Unavailable</p>
                      </div>
                    );
                  }

                  const isSelected = startTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`rounded-md border px-2 py-1.5 text-left cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-green-300 bg-white hover:bg-green-50"
                      }`}
                      onClick={() => setStartTime(slot)}
                    >
                      <p className="text-xs font-medium">{slot}</p>
                      <p className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-green-600"}`}>
                        Available
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {date && timeSlots.length === 0 && (
            <p className="text-sm text-muted-foreground">No available slots for this date (business closed).</p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Rescheduling..." : "Confirm Reschedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Appointment Dialog ────────────────────────

interface CartItem {
  id: string; // local unique key
  serviceId: string;
  serviceOptionId: string;
  quantity: number;
  selectedSubOptionIds: string[];
}

let cartItemCounter = 0;
function newCartItemId() { return `cart-${++cartItemCounter}`; }

function CreateAppointmentDialog({
  prefilledDate, existingAppointments, onSelectAppointment, onClose, onCreated,
}: {
  prefilledDate: string | null;
  existingAppointments?: Appointment[];
  onSelectAppointment?: (a: Appointment) => void;
  onClose: () => void;
  onCreated: () => void;
}) {
  // Multi-item cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([
    { id: newCartItemId(), serviceId: "", serviceOptionId: "", quantity: 1, selectedSubOptionIds: [] },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [date, setDate] = useState(prefilledDate || "");
  const [startTime, setStartTime] = useState("");
  const [notesField, setNotesField] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Fetch services
  const { data: servicesData } = useQuery<{ data: Service[] }>({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
  });

  // Fetch business hours + appointments for the selected date's month
  const dateMonth = date ? date.substring(0, 7) : null;
  const { data: bhData } = useQuery<CalendarResponse>({
    queryKey: ["business-hours-for-create", dateMonth],
    queryFn: async () => {
      const m = dateMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      const res = await fetch(`/api/appointments?mode=calendar&month=${m}`);
      if (!res.ok) throw new Error("Request failed");
      return res.json();
    },
  });

  const appointmentsForDate: Appointment[] = useMemo(() => {
    if (existingAppointments && existingAppointments.length > 0) return existingAppointments;
    if (!date || !bhData?.data) return [];
    return (bhData.data[date] || []) as Appointment[];
  }, [existingAppointments, date, bhData?.data]);

  const services: Service[] = servicesData?.data || [];

  function updateCartItem(itemId: string, updates: Partial<CartItem>) {
    setCartItems((prev) => prev.map((item) => item.id === itemId ? { ...item, ...updates } : item));
    setStartTime(""); // reset time when cart changes
  }

  function addCartItem() {
    setCartItems((prev) => [
      ...prev,
      { id: newCartItemId(), serviceId: "", serviceOptionId: "", quantity: 1, selectedSubOptionIds: [] },
    ]);
  }

  function removeCartItem(itemId: string) {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
    setStartTime("");
  }

  // Time slots based on business hours
  const timeSlots = useMemo(() => {
    if (!date || !bhData?.businessHours) return [];
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const bh = bhData.businessHours.find((h: BusinessHour) => h.day === dayNames[dayOfWeek]);
    if (!bh || !bh.isOpen) return [];
    return generateTimeSlots(bh.openTime, bh.closeTime, 30);
  }, [date, bhData?.businessHours]);

  const occupiedSlotMap = useMemo(() => {
    const map = new Map<number, Appointment>();
    for (const apt of appointmentsForDate) {
      if (apt.status === "CANCELLED" || apt.status === "NO_SHOW") continue;
      const startMin = timeStringToMinutes(apt.startTime);
      const endMin = timeStringToMinutes(apt.endTime);
      for (let m = startMin; m < endMin; m += 30) {
        map.set(m, apt);
      }
    }
    return map;
  }, [appointmentsForDate]);

  const conflictingAppointments = useMemo(() => {
    if (!appointmentsForDate.length || !date || !bhData?.businessHours) return [];
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const bh = bhData.businessHours.find((h: BusinessHour) => h.day === dayNames[dayOfWeek]);
    if (!bh || !bh.isOpen) return [];
    const openMin = timeStringToMinutes(bh.openTime);
    const closeMin = timeStringToMinutes(bh.closeTime);
    return appointmentsForDate.filter((apt) => {
      if (apt.status === "CANCELLED" || apt.status === "NO_SHOW") return false;
      const startMin = timeStringToMinutes(apt.startTime);
      const endMin = timeStringToMinutes(apt.endTime);
      return startMin < openMin || endMin > closeMin;
    });
  }, [appointmentsForDate, date, bhData?.businessHours]);

  // Aggregate duration and price across all cart items
  const { totalDuration: aggregateDuration, totalPrice: computedPrice } = useMemo(() => {
    let dur = 0;
    let price = 0;
    for (const item of cartItems) {
      const svc = services.find((s) => s.id === item.serviceId);
      if (!svc) continue;
      const opt = svc.options.find((o) => o.id === item.serviceOptionId) || null;
      const itemDur = (opt?.duration ?? svc.duration) * (item.quantity || 1);
      dur += itemDur;
      price += computeAppointmentPrice(
        { quantity: item.quantity || 1, selectedSubOptions: item.selectedSubOptionIds },
        svc,
        opt ? { price: opt.price, subOptions: opt.subOptions } : null
      );
    }
    return { totalDuration: dur, totalPrice: price };
  }, [cartItems, services]);

  const aggregateSlotsNeeded = Math.ceil(aggregateDuration / 30);

  async function handleSubmit() {
    setError("");
    setFieldErrors({});
    setSubmitting(true);
    try {
      const items = cartItems
        .filter((item) => item.serviceId)
        .map((item) => ({
          serviceId: item.serviceId,
          serviceOptionId: item.serviceOptionId || undefined,
          quantity: item.quantity,
          selectedSubOptionIds: item.selectedSubOptionIds.length > 0 ? item.selectedSubOptionIds : undefined,
        }));

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          customerName,
          customerPhone,
          customerEmail: customerEmail || undefined,
          date,
          startTime,
          notes: notesField || undefined,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const result = await res.json();
      if (!result.success) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        setError(result.error || "Failed to create appointment");
        return;
      }
      onCreated();
    } catch {
      setError("Failed to create appointment");
    } finally {
      setSubmitting(false);
    }
  }

  const hasValidItem = cartItems.some((item) => item.serviceId);
  const canSubmit = hasValidItem && customerName && customerPhone && date && startTime && !submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Create Appointment</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Cart Items */}
          {cartItems.map((cartItem, idx) => {
            const svc = services.find((s) => s.id === cartItem.serviceId) || null;
            const opt = svc?.options.find((o) => o.id === cartItem.serviceOptionId) || null;
            return (
              <div key={cartItem.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Service {cartItems.length > 1 ? `#${idx + 1}` : ""}</Label>
                  {cartItems.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCartItem(cartItem.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Select
                  value={cartItem.serviceId}
                  onChange={(e) => updateCartItem(cartItem.id, { serviceId: e.target.value, serviceOptionId: "", quantity: 1, selectedSubOptionIds: [] })}
                >
                  <option value="">Select a service</option>
                  {services.filter((s) => s.options?.length > 0 || s.price != null).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>

                {/* Options */}
                {svc && svc.options.length > 0 && (
                  <div className="space-y-1.5">
                    {svc.options.map((o) => (
                      <label
                        key={o.id}
                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${
                          cartItem.serviceOptionId === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`opt-${cartItem.id}`}
                          checked={cartItem.serviceOptionId === o.id}
                          onChange={() => updateCartItem(cartItem.id, { serviceOptionId: o.id, quantity: o.defaultQuantity || 1, selectedSubOptionIds: [] })}
                          className="accent-primary"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{o.name}</p>
                          {o.description && <p className="text-xs text-muted-foreground">{o.description}</p>}
                        </div>
                        {o.price != null && <span className="text-sm font-medium">{formatCurrency(o.price)}</span>}
                      </label>
                    ))}
                  </div>
                )}

                {/* Quantity */}
                {opt && opt.maxQuantity > 1 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">Qty:</span>
                    <Button variant="outline" size="icon" className="h-7 w-7"
                      disabled={cartItem.quantity <= opt.minQuantity}
                      onClick={() => updateCartItem(cartItem.id, { quantity: Math.max(opt.minQuantity, cartItem.quantity - 1) })}
                    ><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm font-medium w-6 text-center">{cartItem.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7"
                      disabled={cartItem.quantity >= opt.maxQuantity}
                      onClick={() => updateCartItem(cartItem.id, { quantity: Math.min(opt.maxQuantity, cartItem.quantity + 1) })}
                    ><Plus className="h-3 w-3" /></Button>
                  </div>
                )}

                {/* Sub-options */}
                {opt && opt.subOptions.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Add-ons:</span>
                    {opt.subOptions.map((sub) => (
                      <label key={sub.id} className="flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-muted/30">
                        <input
                          type="checkbox"
                          checked={cartItem.selectedSubOptionIds.includes(sub.id)}
                          onChange={(e) => {
                            updateCartItem(cartItem.id, {
                              selectedSubOptionIds: e.target.checked
                                ? [...cartItem.selectedSubOptionIds, sub.id]
                                : cartItem.selectedSubOptionIds.filter((id) => id !== sub.id),
                            });
                          }}
                          className="accent-primary"
                        />
                        <span className="flex-1 text-sm">{sub.name}</span>
                        {sub.price != null && sub.price > 0 && (
                          <span className="text-xs text-muted-foreground">+{formatCurrency(sub.price)}</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add another service button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addCartItem}
          >
            <Plus className="h-4 w-4 mr-1" /> Add Another Service
          </Button>

          <hr />

          {/* Customer info */}
          <div>
            <Label>Customer Name</Label>
            <Input
              className={`mt-1 ${fieldErrors.customerName ? "border-destructive" : ""}`}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="John Doe"
            />
            {fieldErrors.customerName && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.customerName}</p>
            )}
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              className={`mt-1 ${fieldErrors.customerPhone ? "border-destructive" : ""}`}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
            {fieldErrors.customerPhone && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.customerPhone}</p>
            )}
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input
              className={`mt-1 ${fieldErrors.customerEmail ? "border-destructive" : ""}`}
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="john@example.com"
            />
            {fieldErrors.customerEmail && (
              <p className="text-xs text-destructive mt-1">{fieldErrors.customerEmail}</p>
            )}
          </div>

          <hr />

          {/* Date */}
          <div>
            <Label>Date</Label>
            <Input
              className="mt-1"
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setStartTime(""); }}
            />
          </div>

          {/* Conflict warning */}
          {conflictingAppointments.length > 0 && (
            <div className="rounded-lg border border-orange-300 bg-orange-50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-700">
                  {conflictingAppointments.length} appointment{conflictingAppointments.length > 1 ? "s" : ""} outside business hours
                </span>
              </div>
              <div className="space-y-1">
                {conflictingAppointments.map((apt) => (
                  <button
                    key={apt.id}
                    type="button"
                    className="w-full text-left text-xs p-1.5 rounded hover:bg-orange-100 text-orange-800 transition-colors"
                    onClick={() => onSelectAppointment?.(apt)}
                  >
                    {apt.startTime}–{apt.endTime} · {apt.customerName} · {apt.service?.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time slots */}
          {date && timeSlots.length > 0 && (
            <div>
              <Label>Time</Label>
              <div className="mt-1 grid grid-cols-4 gap-2">
                {timeSlots.map((slot) => {
                  const slotMin = timeStringToMinutes(slot);
                  const bookedApt = occupiedSlotMap.get(slotMin);

                  // Check overlap using aggregate duration
                  let wouldOverlap = false;
                  if (!bookedApt && hasValidItem) {
                    for (let s = 0; s < aggregateSlotsNeeded; s++) {
                      if (occupiedSlotMap.has(slotMin + s * 30)) {
                        wouldOverlap = true;
                        break;
                      }
                    }
                  }

                  if (bookedApt) {
                    const statusBg: Record<string, string> = {
                      CONFIRMED: "bg-blue-100 border-blue-400",
                      PENDING: "bg-green-100 border-green-400",
                      COMPLETED: "bg-[#6040E0]/15 border-[#6040E0]",
                    };
                    const style = statusBg[bookedApt.status] || "bg-gray-100 border-gray-400";
                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`rounded-md border px-2 py-1.5 text-left cursor-pointer hover:opacity-80 transition-opacity ${style}`}
                        onClick={() => onSelectAppointment?.(bookedApt)}
                      >
                        <p className="text-xs font-medium">{slot}</p>
                        <p className="text-[10px] truncate">{bookedApt.customerName}</p>
                      </button>
                    );
                  }

                  if (wouldOverlap) {
                    return (
                      <div
                        key={slot}
                        className="rounded-md border border-muted bg-muted px-2 py-1.5 text-left opacity-50 cursor-not-allowed"
                      >
                        <p className="text-xs font-medium text-muted-foreground">{slot}</p>
                        <p className="text-[10px] text-muted-foreground">Unavailable</p>
                      </div>
                    );
                  }

                  const isSelected = startTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`rounded-md border px-2 py-1.5 text-left cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-green-300 bg-white hover:bg-green-50"
                      }`}
                      onClick={() => setStartTime(slot)}
                    >
                      <p className="text-xs font-medium">{slot}</p>
                      <p className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-green-600"}`}>
                        Available
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {date && timeSlots.length === 0 && (
            <p className="text-sm text-muted-foreground">No available slots for this date (business closed).</p>
          )}

          {/* Notes */}
          <div>
            <Label>Notes (optional)</Label>
            <Textarea
              className="mt-1"
              value={notesField}
              onChange={(e) => setNotesField(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>

          {/* Summary */}
          {hasValidItem && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm font-medium">Summary</p>
              {cartItems.filter((ci) => ci.serviceId).map((ci) => {
                const svc = services.find((s) => s.id === ci.serviceId);
                const opt = svc?.options.find((o) => o.id === ci.serviceOptionId);
                if (!svc) return null;
                return (
                  <p key={ci.id} className="text-sm text-muted-foreground">
                    {svc.name}{opt ? ` — ${opt.name}` : ""}{ci.quantity > 1 ? ` x${ci.quantity}` : ""}
                  </p>
                );
              })}
              {aggregateDuration > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{aggregateDuration} min total</p>
              )}
              <p className="text-lg font-bold mt-1">{formatCurrency(computedPrice)}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Creating..." : "Create Appointment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
