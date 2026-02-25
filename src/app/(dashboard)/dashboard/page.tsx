"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCardSkeleton } from "@/components/shared/loading";
import {
  PhoneCall,
  PhoneMissed,
  Calendar,
  MessageSquare,
  Mail,
  PhoneForwarded,
} from "lucide-react";

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const json = await res.json();
      return json.data;
    },
  });

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Calls",
      value: stats?.totalCalls ?? 0,
      icon: PhoneCall,
      color: "text-blue-600",
    },
    {
      title: "Missed Calls",
      value: stats?.missedCalls ?? 0,
      icon: PhoneMissed,
      color: "text-red-600",
    },
    {
      title: "Appointments",
      value: stats?.totalAppointments ?? 0,
      icon: Calendar,
      color: "text-green-600",
    },
    {
      title: "Pending Appointments",
      value: stats?.pendingAppointments ?? 0,
      icon: Calendar,
      color: "text-yellow-600",
    },
    {
      title: "Open Complaints",
      value: stats?.openComplaints ?? 0,
      icon: MessageSquare,
      color: "text-orange-600",
    },
    {
      title: "Callback Requests",
      value: stats?.callbackRequests ?? 0,
      icon: PhoneForwarded,
      color: "text-purple-600",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
    </div>
  );
}
