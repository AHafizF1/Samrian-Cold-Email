"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending } = useAuthSession();

  useEffect(() => {
    if (!isPending) {
      if (session?.user) {
        router.replace("/dashboard");
      } else {
        router.replace("/sign-in");
      }
    }
  }, [session, isPending, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
