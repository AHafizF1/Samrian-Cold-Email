"use client";

import * as React from "react";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NotificationsBell } from "@/components/notifications";
import { ensureActiveOrganization, useAuthSession } from "@/lib/auth";
import { Loader2 } from "lucide-react";

/**
 * Ensures the user has an active organization on their session.
 * If not, fetches their orgs and auto-activates the first one.
 */
function useEnsureActiveOrg() {
  const [ready, setReady] = React.useState(false);
  const { data: session } = useAuthSession();
  const attempted = React.useRef(false);

  React.useEffect(() => {
    // Already have an active org — good to go
    if (session?.session?.activeOrganizationId) {
      setReady(true);
      return;
    }

    // Session loaded but no active org — try to set one
    if (session?.user && !session?.session?.activeOrganizationId && !attempted.current) {
      attempted.current = true;

      ensureActiveOrganization(session)
        .then(() => setReady(true))
        .catch(() => {
          // Even if it fails, let the page load — it'll show empty state
          setReady(true);
        });
    }
  }, [session?.user, session?.session?.activeOrganizationId]);

  return ready;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isPending, user } = useAuthGuard();
  const orgReady = useEnsureActiveOrg();

  if (isPending || (user && !orgReady)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9f9f9]">
        <Loader2 className="h-8 w-8 animate-spin text-[#3525cd]" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex flex-1 flex-col overflow-auto bg-[#f9f9f9]">
          <header className="flex h-14 shrink-0 items-center justify-end border-b border-slate-200 bg-white px-6">
            <NotificationsBell />
          </header>
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
