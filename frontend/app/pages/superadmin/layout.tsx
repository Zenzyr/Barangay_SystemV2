"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/store/useUserStore";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSuperAdmin } from "@/components/ui/sidebar_superadmin";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {

    const router = useRouter();
    const { user } = useUserStore();

    useEffect(() => {
      // Dedicated Super Admin area — system configuration pages. Only the
      // "super_admin" role may enter.
      if (!user) {
        router.replace("/guest/signIn");
        return;
      }
      if (user.role !== "super_admin") {
        router.replace("/pages/resident/home");
      }
    }, [user, router]);

    if (!user || user.role !== "super_admin") {
      return null;
    }

    return (
      <div className="flex min-h-screen bg-slate-50">
          <SidebarProvider>

                <SidebarSuperAdmin />

                <main className="w-full min-w-0">
                    <div className="mb-[80px] md:mb-[0px]"> </div>
                    {children}
                </main>
          </SidebarProvider>

      </div>
    );
  }