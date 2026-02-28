import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Header } from "@/components/layout/header";
import { SessionGuard } from "@/components/shared/session-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGuard requiredRole="SUPER_ADMIN">
      <div className="min-h-screen bg-background">
        <AdminSidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </SessionGuard>
  );
}
