"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, Phone, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard,
  PhoneCall,
  Calendar,
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
import { useUnreadCount } from "@/hooks/use-unread-count";

const mobileLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneCall },
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/services", label: "Services", icon: Wrench },
  { href: "/dashboard/sms-logs", label: "SMS Logs", icon: Mail },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/website", label: "Website", icon: Globe },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const PREFETCH_ROUTES: Record<string, { queryKey: unknown[]; url: string }> = {
  "/dashboard/wallet": { queryKey: ["wallet", "1"], url: "/api/wallet?page=1&limit=15" },
  "/dashboard/appointments": { queryKey: ["appointments", 1, null], url: "/api/appointments?page=1&pageSize=20" },
  "/dashboard/customers": { queryKey: ["customers", 1, ""], url: "/api/customers?page=1&pageSize=20" },
  "/dashboard/calls": { queryKey: ["calls", 1, "", ""], url: "/api/calls?page=1&pageSize=20" },
  "/dashboard/sms-logs": { queryKey: ["sms-logs", 1, ""], url: "/api/sms?page=1&pageSize=20" },
  "/dashboard/services": { queryKey: ["services"], url: "/api/services" },
  "/dashboard/campaigns": { queryKey: ["campaigns", 1], url: "/api/campaigns?page=1&pageSize=20" },
  "/dashboard/billing": { queryKey: ["tenant"], url: "/api/tenant" },
  "/dashboard/website": { queryKey: ["tenant"], url: "/api/tenant" },
  "/dashboard/settings": { queryKey: ["tenant"], url: "/api/tenant" },
};

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const prefetch = (href: string) => {
    const config = PREFETCH_ROUTES[href];
    if (config) {
      queryClient.prefetchQuery({
        queryKey: config.queryKey,
        queryFn: async () => {
          const res = await fetch(config.url);
          const json = await res.json();
          return json.success ? json.data : null;
        },
        staleTime: 60000,
      });
    }
  };

  const { data: unreadCount } = useUnreadCount();

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden relative"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            {!mobileMenuOpen && (unreadCount || 0) > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unreadCount! > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <Phone className="h-5 w-5 text-primary" />
            <span className="font-bold">Measy</span>
          </div>

          <div className="flex-1" />

          {/* User info */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {session?.user?.name}
            </span>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
              {session?.user?.name?.charAt(0) || "U"}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-card border-r z-40 pt-14">
            <nav className="px-3 py-4 space-y-1">
              {mobileLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/dashboard" && pathname.startsWith(link.href));
                const badge = link.href === "/dashboard/support" ? (unreadCount || 0) : 0;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onMouseEnter={() => prefetch(link.href)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent"
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
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-muted-foreground mt-4"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
