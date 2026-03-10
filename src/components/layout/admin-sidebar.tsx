"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  Shield,
  LayoutDashboard,
  Building2,
  CreditCard,
  BarChart3,
  Star,
  LifeBuoy,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/admin/plans", label: "Plans", icon: CreditCard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const PREFETCH_ROUTES: Record<string, { queryKey: unknown[]; url: string }> = {
  "/admin": { queryKey: ["admin-stats"], url: "/api/admin/analytics" },
  "/admin/tenants": { queryKey: ["admin-tenants", 1, ""], url: "/api/admin/tenants?page=1&pageSize=20" },
  "/admin/plans": { queryKey: ["admin-plans"], url: "/api/admin/plans" },
  "/admin/analytics": { queryKey: ["admin-stats"], url: "/api/admin/analytics" },
  "/admin/settings": { queryKey: ["platform-settings"], url: "/api/admin/settings" },
};

export function AdminSidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const prefetch = (href: string) => {
    const config = PREFETCH_ROUTES[href];
    if (config) {
      queryClient.prefetchQuery({
        queryKey: config.queryKey,
        queryFn: async () => {
          const res = await fetch(config.url);
          const json = await res.json();
          return json.success ? json.data : json;
        },
        staleTime: 60000,
      });
    }
  };

  const { data: unreadCount } = useQuery<number>({
    queryKey: ["admin-support-unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/admin/support/unread-count");
      const json = await res.json();
      return json.count ?? 0;
    },
    staleTime: 60000,
    refetchInterval: 120000,
  });

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-card">
      <div className="flex items-center gap-2 px-6 py-4 border-b">
        <Shield className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Admin Panel</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {adminLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/admin" && pathname.startsWith(link.href));
          const badge = link.href === "/admin/support" ? (unreadCount || 0) : 0;

          return (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => prefetch(link.href)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
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
      <div className="border-t p-3">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </div>
    </aside>
  );
}
