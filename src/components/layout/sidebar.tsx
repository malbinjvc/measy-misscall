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
  Lock,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/hooks/use-unread-count";
import { usePlanFeatures } from "@/hooks/use-plan-features";
import { prefetchRoute } from "@/lib/prefetch-routes";

interface SidebarLink {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  requiredFeature?: string;
}

const sidebarLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/calls", label: "Calls", icon: PhoneCall, requiredFeature: "missed_call_ivr" },
  { href: "/dashboard/appointments", label: "Appointments", icon: Calendar },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
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

export function Sidebar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const prefetch = (href: string) => prefetchRoute(queryClient, href);

  const { data: unreadCount } = useUnreadCount();
  const { hasFeature } = usePlanFeatures();

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
          const isLocked = link.requiredFeature ? !hasFeature(link.requiredFeature) : false;

          if (isLocked) {
            return (
              <Link
                key={link.href}
                href="/dashboard/billing"
                className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground/50 hover:bg-accent/50 transition-colors"
                title="Upgrade your plan to access this feature"
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
