"use client";

import { useQuery } from "@tanstack/react-query";

interface CallRecord {
  id: string;
  from: string;
  status: string;
  ivrResponse: string | null;
  createdAt: string;
  [key: string]: unknown;
}

interface PaginatedResponse<T> {
  data: T[];
  page: number;
  totalPages: number;
  total: number;
}

interface AppointmentRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  [key: string]: unknown;
}

interface ServiceRecord {
  id: string;
  name: string;
  duration: number;
  price: number | null;
  [key: string]: unknown;
}

interface DashboardStats {
  totalCalls: number;
  totalAppointments: number;
  totalRevenue: number;
  [key: string]: unknown;
}

export function useCalls(page: number = 1, status?: string, ivrResponse?: string) {
  return useQuery<PaginatedResponse<CallRecord>>({
    queryKey: ["calls", page, status, ivrResponse],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (status) params.set("status", status);
      if (ivrResponse) params.set("ivrResponse", ivrResponse);
      const res = await fetch(`/api/calls?${params}`);
      if (!res.ok) throw new Error("Failed to fetch calls");
      return res.json();
    },
  });
}

export function useAppointments(page: number = 1, status?: string) {
  return useQuery<PaginatedResponse<AppointmentRecord>>({
    queryKey: ["appointments", page, status],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (status) params.set("status", status);
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Failed to fetch appointments");
      return res.json();
    },
  });
}

export function useServices() {
  return useQuery<{ data: ServiceRecord[] }>({
    queryKey: ["services"],
    queryFn: async () => {
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      return json.data;
    },
  });
}
