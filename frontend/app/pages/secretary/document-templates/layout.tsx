"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/store/useUserStore";

const HOME_BY_ROLE: Record<string, string> = {
  super_admin: "/pages/superadmin/home",
  resident: "/pages/resident/home",
};

export default function DocumentTemplatesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, _hasHydrated } = useUserStore();
  const allowed = user?.role === "secretary";

  useEffect(() => {
    if (!_hasHydrated || allowed) return;
    router.replace(user ? HOME_BY_ROLE[user.role || ""] ?? "/pages/resident/home" : "/guest/signIn");
  }, [_hasHydrated, allowed, user, router]);

  if (!_hasHydrated || !allowed) return null;

  return <>{children}</>;
}
