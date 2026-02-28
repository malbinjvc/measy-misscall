import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TenantProvider } from "@/providers/tenant-provider";
import { SessionGuard } from "@/components/shared/session-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionGuard requiredRole="TENANT">
      <TenantProvider>
        <div className="min-h-screen bg-background">
          <Sidebar />
          <div className="lg:pl-64">
            <Header />
            <main className="p-4 lg:p-6">{children}</main>
          </div>
        </div>
      </TenantProvider>
    </SessionGuard>
  );
}
