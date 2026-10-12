"use client";

import { AccountSettings } from "@/components/ui/accountSettings";
import useUserStore from "@/app/store/useUserStore";

export default function Page() {
  const role = useUserStore((s) => s.user?.role);
  const isSuperAdmin = role === "super_admin";

  return (
    <AccountSettings
      backHref={isSuperAdmin ? "/pages/secretary/barangaySettings" : "/pages/secretary/home"}
      backLabel={isSuperAdmin ? "Back to Settings" : "Back to Dashboard"}
    />
  );
}
