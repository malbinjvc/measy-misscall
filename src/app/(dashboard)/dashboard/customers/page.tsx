"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingTable, LoadingPage } from "@/components/shared/loading";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Search, ChevronLeft, ChevronRight, Phone, Mail, Calendar,
  CheckCircle, XCircle, X, Car, MessageSquare, PhoneCall, Clock,
  DollarSign, ChevronDown, Loader2,
} from "lucide-react";
import { formatPhoneNumber, formatDateTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  smsConsent: boolean;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  notes: string | null;
  createdAt: string;
  appointmentCount: number;
  lastBooking: string | null;
}

interface CustomerVehicle {
  id: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleType: string | null;
}

interface CustomerDetail extends CustomerRow {
  vehicles: CustomerVehicle[];
}

interface BookingItem {
  id: string;
  quantity: number;
  service: { id: string; name: string; price: number | null } | null;
  serviceOption: { id: string; name: string; price: number | null } | null;
}

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  customerName: string;
  vehicleYear: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  notes: string | null;
  quantity: number;
  createdAt: string;
  service: { id: string; name: string; price: number | null } | null;
  serviceOption: { id: string; name: string; price: number | null } | null;
  items: BookingItem[];
}

interface SmsEntry {
  id: string;
  body: string;
  status: string;
  type: string;
  toNumber: string;
  createdAt: string;
}

interface CallEntry {
  id: string;
  callerNumber: string;
  status: string;
  ivrResponse: string;
  callbackHandled: boolean;
  duration: number | null;
  createdAt: string;
}

interface CustomersResponse {
  success: boolean;
  data: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type ActivityTab = "bookings" | "sms" | "calls";

// ─── Helpers ──────────────────────────────────────────

function formatVehicle(v: { vehicleYear?: string | null; vehicleMake?: string | null; vehicleModel?: string | null }) {
  return [v.vehicleYear, v.vehicleMake, v.vehicleModel].filter(Boolean).join(" ");
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPrice(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "";
  const num = typeof price === "string" ? parseFloat(price) : price;
  return `$${num.toFixed(2)}`;
}

// ─── Activity Panel ───────────────────────────────────

function CustomerPanel({
  customerId,
  onClose,
}: {
  customerId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ActivityTab>("bookings");
  const [cursor, setCursor] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<unknown[]>([]);

  // Switch tab: reset cursor + items synchronously in the same batch
  // (useEffect runs AFTER render, causing stale data to render with wrong tab component)
  const changeTab = useCallback((newTab: ActivityTab) => {
    setTab(newTab);
    setCursor(null);
    setAllItems([]);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-detail", customerId, tab, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({ tab });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/customers/${customerId}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 30000,
  });

  // Accumulate items on load more
  useEffect(() => {
    if (!data?.data) return;
    const items = data.data.bookings || data.data.smsLogs || data.data.calls || [];
    if (cursor) {
      setAllItems((prev) => [...prev, ...items]);
    } else {
      setAllItems(items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const customer: CustomerDetail | undefined = data?.data?.customer;
  const hasMore = data?.hasMore ?? false;
  const nextCursor = data?.nextCursor ?? null;

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const tabs: { key: ActivityTab; label: string; icon: typeof Calendar }[] = [
    { key: "bookings", label: "Bookings", icon: Calendar },
    { key: "sms", label: "SMS", icon: MessageSquare },
    { key: "calls", label: "Calls", icon: PhoneCall },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l shadow-xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b shrink-0">
          <div className="min-w-0">
            {customer ? (
              <>
                <h2 className="text-lg font-semibold truncate">{customer.name}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {formatPhoneNumber(customer.phone)}
                  </span>
                  {customer.email && (
                    <span className="flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3" />
                      {customer.email}
                    </span>
                  )}
                </div>
                {customer.notes && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{customer.notes}</p>
                )}
              </>
            ) : (
              <div className="h-10 w-40 animate-pulse bg-muted rounded" />
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Vehicles */}
        {customer?.vehicles && customer.vehicles.length > 0 && (
          <div className="px-4 py-3 border-b shrink-0">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <Car className="h-3 w-3" /> Vehicles
            </p>
            <div className="flex flex-wrap gap-2">
              {customer.vehicles.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs font-medium"
                >
                  {formatVehicle(v)}
                  {v.vehicleType && <span className="text-muted-foreground">({v.vehicleType})</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b px-4 shrink-0">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => changeTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && allItems.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {tab === "bookings" && <BookingsTab bookings={allItems as Booking[]} />}
              {tab === "sms" && <SmsTab smsLogs={allItems as SmsEntry[]} />}
              {tab === "calls" && <CallsTab calls={allItems as CallEntry[]} />}

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCursor(nextCursor)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 mr-1" />
                    )}
                    Load more
                  </Button>
                </div>
              )}

              {allItems.length === 0 && !isLoading && (
                <EmptyState
                  icon={
                    tab === "bookings" ? <Calendar className="h-10 w-10" /> :
                    tab === "sms" ? <MessageSquare className="h-10 w-10" /> :
                    <PhoneCall className="h-10 w-10" />
                  }
                  title={`No ${tab}`}
                  description={`No ${tab} history found for this customer.`}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Tab Content ──────────────────────────────────────

function BookingsTab({ bookings }: { bookings: Booking[] }) {
  return (
    <div className="space-y-3">
      {bookings.map((b) => {
        const vehicle = formatVehicle(b);
        const isMultiItem = b.items && b.items.length > 0;
        return (
          <div key={b.id} className="rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                {isMultiItem ? (
                  <div className="space-y-1">
                    {b.items.map((item, idx) => (
                      <p key={item.id} className="text-sm font-medium">
                        {idx + 1}. {item.service?.name || "Service"}
                        {item.serviceOption && <span className="text-muted-foreground"> — {item.serviceOption.name}</span>}
                        {item.quantity > 1 && <span className="text-muted-foreground"> x{item.quantity}</span>}
                        {(item.serviceOption?.price || item.service?.price) && (
                          <span className="text-muted-foreground ml-1">
                            ({formatPrice(item.serviceOption?.price ?? item.service?.price)})
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium">
                    {b.service?.name || "Service"}
                    {b.serviceOption && <span className="text-muted-foreground"> — {b.serviceOption.name}</span>}
                    {b.quantity > 1 && <span className="text-muted-foreground"> x{b.quantity}</span>}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(b.date)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {b.startTime} – {b.endTime}
                  </span>
                  {!isMultiItem && (b.serviceOption?.price || b.service?.price) && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatPrice(b.serviceOption?.price ?? b.service?.price)}
                    </span>
                  )}
                </div>
                {vehicle && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Car className="h-3 w-3" /> {vehicle}
                  </p>
                )}
                {b.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{b.notes}</p>
                )}
              </div>
              <StatusBadge status={b.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SmsTab({ smsLogs }: { smsLogs: SmsEntry[] }) {
  return (
    <div className="space-y-2">
      {smsLogs.map((sms) => (
        <div key={sms.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm line-clamp-3">{sms.body}</p>
            <StatusBadge status={sms.status} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{formatDateTime(sms.createdAt)}</span>
            <span className="px-1.5 py-0.5 bg-muted rounded text-xs">{sms.type.replace(/_/g, " ")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallsTab({ calls }: { calls: CallEntry[] }) {
  return (
    <div className="space-y-2">
      {calls.map((call) => (
        <div key={call.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StatusBadge status={call.status} />
              <StatusBadge status={call.ivrResponse} />
            </div>
            {call.callbackHandled && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Handled
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{formatDateTime(call.createdAt)}</span>
            {call.duration != null && call.duration > 0 && (
              <span>{call.duration}s</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const pageSize = 20;

  const { data, isLoading } = useQuery<CustomersResponse>({
    queryKey: ["customers", page, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/customers?${params}`);
      return res.json();
    },
    staleTime: 60000,
  });

  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  const customers = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description={`${total} customer${total !== 1 ? "s" : ""}`}
      />

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} variant="outline" size="sm">
          Search
        </Button>
        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingTable />
      ) : customers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No customers found"
          description={search ? "Try a different search term" : "Customers will appear here when they book appointments"}
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-center">Appointments</TableHead>
                  <TableHead className="hidden md:table-cell text-center">SMS Consent</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Booking</TableHead>
                  <TableHead className="hidden lg:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedCustomerId(customer.id)}
                  >
                    <TableCell className="font-medium">
                      <div>
                        {customer.name}
                        {customer.vehicleMake && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[customer.vehicleYear, customer.vehicleMake, customer.vehicleModel].filter(Boolean).join(" ")}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {formatPhoneNumber(customer.phone)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {customer.email ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {customer.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {customer.appointmentCount}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-center">
                      {customer.smsConsent ? (
                        <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {customer.lastBooking
                        ? new Date(customer.lastBooking).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {new Date(customer.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Customer Activity Slide-over Panel */}
      {selectedCustomerId && (
        <CustomerPanel
          key={selectedCustomerId}
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
}
