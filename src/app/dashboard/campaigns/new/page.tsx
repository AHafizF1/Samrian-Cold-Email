"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NewCampaignPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/campaigns/new/wizard");
  }, [router]);

  return null;
}
