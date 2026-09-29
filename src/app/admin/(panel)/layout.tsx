import { AdminShell } from "@/components/admin/AdminShell";
import { AuthGuard } from "@/components/admin/AuthGuard";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AdminShell>{children}</AdminShell>
    </AuthGuard>
  );
}
