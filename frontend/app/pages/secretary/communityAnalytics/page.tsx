"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommunityAnalyticsPage() {
  const router = useRouter();

  useEffect(() => {
    // Community Analytics was merged into the unified Analytics page.
    router.replace("/pages/secretary/analytics");
  }, [router]);

  return null;
}