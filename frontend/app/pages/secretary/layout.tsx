"use client"

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/store/useUserStore";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarSecretary } from "@/components/ui/sidebar_secretary";
import { SidebarSuperAdmin } from "@/components/ui/sidebar_superadmin";

const STAFF_ROLES = ["secretary", "super_admin"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {

    const router = useRouter();
    const { user, _hasHydrated } = useUserStore();

    useEffect(() => {
      if (!_hasHydrated) return;

      // These pages are shared by operational staff: the Secretary and the
      // Super Admin (who may also operate the barangay office). The role is
      // set by the backend during login and verified here on every protected
      // page to prevent direct-URL access bypasses.
      if (!user) {
        router.replace("/guest/signIn");
        return;
      }
      if (!STAFF_ROLES.includes(user.role || "")) {
        router.replace("/pages/resident/home");
      }
    }, [user, router, _hasHydrated]);

    if (!_hasHydrated || !user || !STAFF_ROLES.includes(user.role || "")) {
      return null;
    }

    const Sidebar = user.role === "super_admin" ? SidebarSuperAdmin : SidebarSecretary;

    return (
      <div className="flex min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/70">
          <SidebarProvider>
                
                <Sidebar />
               
                <main className="w-full min-w-0">
                    <div className="mb-[80px] md:mb-[0px]"> </div>
                    {children}
                </main>
          </SidebarProvider>
       
      </div>
    );
  }