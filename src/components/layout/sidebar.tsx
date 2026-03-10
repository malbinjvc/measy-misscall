"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Phone,
  LayoutDashboard,
  PhoneCall,
  Calendar,
  Users,
  Wrench,
  Mail,
  Settings,
  CreditCard,
  Globe,
  LifeBuoy,
  Wallet,
  Megaphone,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/hooks/use-unread-count";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneCall },
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/services", label: "Services", icon: Wrench },
  { href: "/dashboard/sms-logs", label: "SMS Logs", icon: Mail },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/website", label: "Website", icon: Globe },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const PREFETCH_ROUTES: Record<string, { queryKey: unknown[]; url: string; extractData?: boolean }> = {
  "/dashboard/wallet": { queryKey: ["wallet", "1"], url: "/api/wallet?page=1&limit=15", extractData: true },
  "/dashboard/appointments": { queryKey: ["appointments", 1, null], url: "/api/appointments?page=1&pageSize=20" },
  "/dashboard/customers": { queryKey: ["customers", 1, ""], url: "/api/customers?page=1&pageSize=20" },
  "/dashboard/calls": { queryKey: ["calls", 1, "", ""], url: "/api/calls?page=1&pageSize=20" },
  "/dashboard/sms-logs": { queryKey: ["sms-logs", 1, ""], url: "/api/sms?page=1&pageSize=20" },
  "/dashboard/services": { queryKey: ["services"], url: "/api/services" },
  "/dashboard/campaigns": { queryKey: ["campaigns", 1], url: "/api/campaigns?page=1&pageSize=20" },
  "/dashboard/billing": { queryKey: ["tenant"], url: "/api/tenant", extractData: true },
  "/dashboard/website": { queryKey: ["tenant"], url: "/api/tenant", extractData: true },
  "/dashboard/settings": { queryKey: ["tenant"], url: "/api/tenant", extractData: true },
};

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const prefetch = (href: string) => {
    const config = PREFETCH_ROUTES[href];
    if (config) {
      queryClient.prefetchQuery({
        queryKey: config.queryKey,
        queryFn: async () => {
          const res = await fetch(config.url);
          if (!res.ok) return null;
          const json = await res.json();
          return config.extractData ? (json.success ? json.data : null) : json;
        },
        staleTime: 60000,
      });
    }
  };

  const { data: unreadCount } = useUnreadCount();

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-4 border-b">
        <Phone className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Measy MissCall</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {sidebarLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href));
          const badge = link.href === "/dashboard/support" ? (unreadCount || 0) : 0;

          return (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => prefetch(link.href)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
              {badge > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
