"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { resolveAdminAccess } from "@/lib/auth/access";
import { useAuth } from "./AuthProvider";

/** Client-side gate. The real protection is Firestore/Storage rules plus verified tokens on API routes. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { status, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const access = resolveAdminAccess(status, isAdmin);

  useEffect(() => {
    if (access === "login") router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
    if (access === "unauthorized") router.replace("/admin/unauthorized");
  }, [access, pathname, router]);

  if (access !== "allowed") {
    return (
      <div className="grid min-h-screen place-items-center bg-paper" role="status" aria-label="Checking your access">
        <Loader2 className="h-6 w-6 animate-spin text-ink-600" aria-hidden />
      </div>
    );
  }
  return <>{children}</>;
}
