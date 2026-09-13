"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/store/useUserStore";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarResident } from "@/components/ui/sidebar_resident";
import { NotificationBell } from "@/components/ui/notificationBell";
import ResidentPending from "@/components/ui/residentPending";
import ResidentRejected from "@/components/ui/residentRejected";

export default function AdminLayout({ children }: { children: React.ReactNode }) {

    const router = useRouter();
    const { user, _hasHydrated } = useUserStore()

    useEffect(() => {
      // 1. Wait for hydration to complete.
      if (!_hasHydrated) return;

      // 2. Resident pages require an authenticated resident account.
      if (!user) {
        router.replace("/guest/signIn");
        return;
      }
      if (user.role === "secretary") {
        router.replace("/pages/secretary/home");
      } else if (user.role === "super_admin") {
        router.replace("/pages/superadmin/home");
      }
    }, [user, router, _hasHydrated]);

    // Show nothing or a loading state until hydrated
    if (!_hasHydrated || !user) return null;

    if(user?.status == "pending" ) return <ResidentPending />
    if(user?.status == "rejected" ) return <ResidentRejected />

    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/70">
          <SidebarProvider>
                
                <SidebarResident />
               
                <main className="w-full min-w-0">
                    <header className="hidden lg:flex sticky top-0 z-[60] h-14 items-center justify-end px-6 bg-white/75 backdrop-blur-md border-b border-slate-200/80">
                        <NotificationBell position="desktop" />
                    </header>
                    <div className="mb-[80px] md:mb-[0px]"> </div>
                    {children}
                </main>
          </SidebarProvider>
       
      </div>
    );
  }