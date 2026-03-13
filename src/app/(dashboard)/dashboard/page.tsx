"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCardSkeleton } from "@/components/shared/loading";
import {
  PhoneMissed,
  Calendar,
  Mail,
  PhoneForwarded,
  DollarSign,
  Clock,
  XCircle,
  UserX,
} from "lucide-react";

type Preset = "today" | "this_week" | "this_month" | "last_month" | "this_year" | "all_time";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
  { key: "all_time", label: "All Time" },
];

// Format a Date in Toronto timezone as YYYY-MM-DD
function toTorontoDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function getDateRange(preset: Preset): { from: string; to: string } | null {
  const now = new Date();
  const todayStr = toTorontoDate(now);
  const [y, m, d] = todayStr.split("-").map(Number);

  switch (preset) {
    case "today":
      return { from: todayStr, to: todayStr };
    case "this_week": {
      // Monday to Sunday of current week
      const todayDate = new Date(y, m - 1, d);
      const day = todayDate.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const monday = new Date(y, m - 1, d - diff);
      const sunday = new Date(y, m - 1, d - diff + 6);
      return { from: toTorontoDate(monday), to: toTorontoDate(sunday) };
    }
    case "this_month": {
      // Full month: 1st to last day
      const lastDay = new Date(y, m, 0); // day 0 of next month = last day of this month
      return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: toTorontoDate(lastDay) };
    }
    case "last_month": {
      const lmStart = new Date(y, m - 2, 1);
      const lmEnd = new Date(y, m - 1, 0);
      return { from: toTorontoDate(lmStart), to: toTorontoDate(lmEnd) };
    }
    case "this_year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "all_time":
      return null;
  }
}

interface BannerData {
  url: string;
  type: "image" | "video";
  link: string | null;
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<Preset>("this_week");
  const [dateMode, setDateMode] = useState<"scheduled" | "created">("created");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const range = useMemo(() => getDateRange(preset), [preset]);

  const { data: banner } = useQuery<BannerData | null>({
    queryKey: ["dashboard-banner"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/banner");
      const json = await res.json();
      return json.data ?? null;
    },
    staleTime: 60_000,
  });

  const { data: stats, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-stats", preset, dateMode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range) {
        params.set("from", range.from);
        params.set("to", range.to);
      }
      params.set("dateMode", dateMode);
      const url = `/api/dashboard/stats${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      return json.data;
    },
    staleTime: 60000,
  });

  const callbackCount = stats?.callbackRequests ?? 0;
  const hasCallbacks = callbackCount > 0;

  const statCards = [
    {
      title: "Processing Appointments",
      value: stats?.pendingAppointments ?? 0,
      icon: Clock,
      color: "text-green-600",
    },
    {
      title: "Total Appointments",
      value: stats?.totalAppointments ?? 0,
      icon: Calendar,
      color: "text-green-600",
    },
    {
      title: "Total Revenue",
      value: `$${(stats?.totalRevenue ?? 0).toFixed(2)}`,
      icon: DollarSign,
      color: "text-emerald-600",
    },
    {
      title: "Total Missed Calls",
      value: stats?.missedCalls ?? 0,
      icon: PhoneMissed,
      color: "text-red-600",
    },
    {
      title: "Total Messages",
      value: stats?.totalSms ?? 0,
      icon: Mail,
      color: "text-blue-600",
    },
    {
      title: "Cancelled Appointments",
      value: stats?.cancelledAppointments ?? 0,
      icon: XCircle,
      color: "text-orange-600",
    },
    {
      title: "No Show",
      value: stats?.noShowAppointments ?? 0,
      icon: UserX,
      color: "text-gray-600",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>

      {/* Admin Banner */}
      {banner && !bannerDismissed && (
        <div className="mb-6 relative rounded-xl overflow-hidden border shadow-sm">
          <button
            onClick={() => setBannerDismissed(true)}
            className="absolute top-2 right-2 z-10 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition-colors"
            aria-label="Dismiss banner"
          >
            <XCircle className="h-4 w-4" />
          </button>
          {banner.link ? (
            <a href={banner.link} target="_blank" rel="noopener noreferrer" className="block">
              {banner.type === "video" ? (
                <video
                  src={banner.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full object-cover"
                  style={{ maxHeight: 280 }}
                />
              ) : (
                <img src={banner.url} alt="Announcement" className="w-full object-cover" style={{ maxHeight: 280 }} />
              )}
            </a>
          ) : (
            <>
              {banner.type === "video" ? (
                <video
                  src={banner.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full object-cover"
                  style={{ maxHeight: 280 }}
                />
              ) : (
                <img src={banner.url} alt="Announcement" className="w-full object-cover" style={{ maxHeight: 280 }} />
              )}
            </>
          )}
        </div>
      )}

      {/* Date Filter Presets + Date Mode Toggle */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              preset === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto flex items-center rounded-md border border-blue-200 bg-blue-50 p-0.5">
          <button
            onClick={() => setDateMode("scheduled")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              dateMode === "scheduled"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-blue-600 hover:text-blue-800"
            }`}
          >
            Scheduled
          </button>
          <button
            onClick={() => setDateMode("created")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              dateMode === "created"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-blue-600 hover:text-blue-800"
            }`}
          >
            Created
          </button>
        </div>
      </div>

      {/* Callback Requests — always visible, not date-filtered */}
      {hasCallbacks && (
        <div className="mb-6 rounded-lg border-2 border-red-500 bg-red-50 p-4 flex items-center gap-4 animate-pulse-slow">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100">
            <PhoneForwarded className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-red-700">
              {callbackCount} Callback Request{callbackCount !== 1 ? "s" : ""} Pending
            </p>
            <p className="text-sm text-red-600">
              Customers are waiting for a callback. Please follow up as soon as possible.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-muted-foreground mb-2">Failed to load stats</p>
          <button onClick={() => refetch()} className="text-sm text-primary hover:underline">Try again</button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
