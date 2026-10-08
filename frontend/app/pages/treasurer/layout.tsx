"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/store/useUserStore";
import { ROLES, homeForRole } from "@/lib/constants/roles";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarTreasurer } from "@/components/ui/sidebar_treasurer";
import AccountSuspended from "@/components/ui/accountSuspended";

export default function TreasurerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, _hasHydrated } = useUserStore();
  const isTreasurer = user?.role === ROLES.TREASURER;

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user) {
      router.replace("/guest/signIn");
      return;
    }
    if (!isTreasurer) {
      router.replace(homeForRole(user.role));
    }
  }, [user, isTreasurer, router, _hasHydrated]);

  if (!_hasHydrated || !user || !isTreasurer) {
    return null;
  }

  if (user.isSuspended) return <AccountSuspended />;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/70">
      <SidebarProvider>
        <SidebarTreasurer />
        <main className="w-full min-w-0 pt-20 md:pt-0">
          {children}
        </main>
      </SidebarProvider>
    </div>
  );
}
