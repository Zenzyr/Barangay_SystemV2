import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useUserStore from "@/app/store/useUserStore";

/**
 * Redirects non-Super Admins away from system configuration pages.
 * Returns whether the current user is allowed to manage this area.
 */
export function useSuperAdminGuard() {
  const router = useRouter();
  const { user } = useUserStore();

  useEffect(() => {
    if (!user) {
      router.replace("/guest/signIn");
      return;
    }
    if (user.role !== "super_admin") {
      router.replace("/pages/secretary/home");
    }
  }, [user, router]);

  return { isSuperAdmin: !!user && user.role === "super_admin" };
}