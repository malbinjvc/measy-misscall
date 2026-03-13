"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Menu, Phone, X, Lock } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import {
  LayoutDashboard,
  PhoneCall,
  Calendar,
  UserPlus,
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
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { prefetchRoute } from "@/lib/prefetch-routes";

interface MobileLink {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  requiredFeature?: string;
}

const mobileLinks: MobileLink[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneCall, requiredFeature: "missed_call_ivr" },
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/services", label: "Services", icon: Wrench },
  { href: "/dashboard/sms-logs", label: "SMS Logs", icon: Mail },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone, requiredFeature: "campaigns" },
  { href: "/dashboard/staff", label: "Team", icon: UserPlus },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/website", label: "Website", icon: Globe },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const prefetch = (href: string) => prefetchRoute(queryClient, href);

  const { data: unreadCount } = useUnreadCount();
  const { hasFeature } = usePlanFeatures();

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
                const isLocked = link.requiredFeature ? !hasFeature(link.requiredFeature) : false;

                if (isLocked) {
                  return (
                    <Link
                      key={link.href}
                      href="/dashboard/billing"
                      onClick={() => setMobileMenuOpen(false)}
                      className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50 transition-colors"
                    >
                      <link.icon className="h-4 w-4" />
                      <span className="group-hover:hidden">{link.label}</span>
                      <span className="hidden group-hover:inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white" style={{ backgroundColor: "#6040E0" }}>
                        Upgrade
                      </span>
                      <Lock className="ml-auto h-3 w-3 group-hover:hidden" />
                    </Link>
                  );
                }

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
