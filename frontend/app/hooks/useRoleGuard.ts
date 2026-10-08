import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/store/useUserStore";
import { homeForRole } from "@/lib/constants/roles";

/**
 * Redirects non-Super Admins away from system configuration pages.
 * Returns whether the current user is allowed to manage this area.
 */
export function useSuperAdminGuard() {
  const router = useRouter();
  const { user, _hasHydrated } = useUserStore();

  useEffect(() => {

    if (!_hasHydrated) return;

    if (!user) {
      router.replace("/guest/signIn");
      return;
    }
    if (user.role !== "super_admin") {
      router.replace(user.role === "secretary" ? "/pages/secretary/home" : homeForRole(user.role));
    }
  }, [user, router, _hasHydrated]);

  return { isSuperAdmin: _hasHydrated && !!user && user.role === "super_admin" };
}