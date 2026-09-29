"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/admin/AuthProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function UnauthorizedPage() {
  const router = useRouter();
  const toast = useToast();
  const { status, isAdmin, user, signOut, refreshAccess } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "signed-out") router.replace("/admin/login");
    if (status === "signed-in" && isAdmin) router.replace("/admin");
  }, [status, isAdmin, router]);

  const recheck = async () => {
    setBusy(true);
    try {
      if (await refreshAccess()) router.replace("/admin");
      else toast.error("This account still doesn't have admin access.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="panel w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-bad/10 text-bad"><ShieldAlert className="h-6 w-6" aria-hidden /></div>
        <h1 className="text-xl font-semibold">You don&apos;t have admin access</h1>
        <p className="mt-2 text-sm text-muted">
          {user?.email ? <>You&apos;re signed in as <strong className="text-ink-900">{user.email}</strong>, but this account hasn&apos;t been granted admin rights.</> : "This account hasn't been granted admin rights."}
          {" "}Ask an existing admin to grant access, then check again.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button variant="dark" onClick={recheck} loading={busy}>Check again</Button>
          <Button variant="secondary" onClick={async () => { await signOut(); router.replace("/admin/login"); }}>Sign out</Button>
          <ButtonLink href="/" variant="ghost">Public site</ButtonLink>
        </div>
      </div>
    </div>
  );
}
