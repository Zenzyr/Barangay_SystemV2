"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Home,
  Users,
  UserRoundCheck,
  Landmark,
  MapPin,
  BarChart3,
  ChartPie,
  Sparkles,
  ScrollText,
  Settings2,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
} from "lucide-react"
import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { SidebarBrand } from "@/components/ui/sidebar_shared";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/pages/superadmin/home", icon: Home }],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Roles", url: "/pages/superadmin/users", icon: Users },
      { title: "Residents", url: "/pages/secretary/residentCensus", icon: UserRoundCheck },
      { title: "Officials", url: "/pages/secretary/barangaySettings/officials", icon: Landmark },
      { title: "Puroks", url: "/pages/secretary/barangaySettings/puroks", icon: MapPin },
      { title: "Settings", url: "/pages/secretary/barangaySettings", icon: Settings2 },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { title: "Analytics", url: "/pages/secretary/analytics", icon: BarChart3 },
      { title: "Decision Support", url: "/pages/secretary/decisionSupport", icon: Sparkles },
      { title: "Audit Trail", url: "/pages/secretary/barangaySettings/audit", icon: ScrollText },
    ],
  },
]

interface AppSidebarProps {
  className?: string
}


function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.url}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
        active
          ? "bg-slate-100 text-slate-900"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <item.icon
        className={cn(
          "size-4 shrink-0",
          active ? "text-slate-700" : "text-slate-400"
        )}
      />
      <span className="flex-1">{item.title}</span>
      {active && <ChevronRight className="size-3.5 text-slate-400" />}
    </Link>
  )
}

function NavTree({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (url: string) => {
    const base = url.split("?")[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <nav className="space-y-5">
      {navigationGroups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.title}
                item={item}
                active={isActive(item.url)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function SidebarSuperAdmin({ className }: AppSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  const closeMobileMenu = () => setIsMobileMenuOpen(false)
  const queryClient = useQueryClient()
  const router = useRouter()


  const logoutHandler = async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    setIsMobileMenuOpen(false);
    router.replace("/");
  };

  return (
    <>
      {/* ── Mobile Navbar ── */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-slate-200/50 bg-white/50 backdrop-blur-md px-4 py-3 lg:hidden">
        <SidebarBrand subtitle="Super Admin" href="/pages/superadmin/home" />
        <button
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          className="rounded-md p-2 text-slate-600 transition-colors hover:bg-slate-100"
        >
          {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/40 lg:hidden"
          onClick={closeMobileMenu}
        >
          <div
            className="flex h-full w-72 max-w-[85vw] flex-col bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <SidebarBrand
                subtitle="Super Admin"
                href="/pages/superadmin/home"
                onNavigate={closeMobileMenu}
              />
              <button
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
              <NavTree onNavigate={closeMobileMenu} />
            </div>

            <div className="border-t border-slate-200 p-3">
              <button
                type="button"
                onClick={logoutHandler}
                className="flex w-full items-center gap-3 rounded-md bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-100"
              >
                <LogOut className="size-4 shrink-0 text-rose-500" />
                <span className="flex-1">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <Sidebar
        className={cn(
          "hidden border-r border-slate-200/50 bg-white/70 backdrop-blur-md shadow-sm lg:flex",
          className
        )}
      >
        <SidebarHeader className="border-b border-slate-200 px-4 py-4">
          <SidebarBrand subtitle="Super Admin" href="/pages/superadmin/home" />
        </SidebarHeader>

        <SidebarContent className="scrollbar-thin overflow-y-auto px-3 py-4">
          <NavTree />
          <div className="mt-5 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            <ShieldCheck className="size-3.5 shrink-0 text-slate-500" />
            <span>Full system configuration access</span>
          </div>
        </SidebarContent>

        <SidebarFooter className="border-t border-slate-200 p-3">
          <Link
            href="/"
            onClick={logoutHandler}
            className="flex items-center gap-3 rounded-md bg-rose-50 px-3 py-2 text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-100"
          >
            <LogOut className="size-4 shrink-0 text-rose-500" />
            <span className="flex-1">Logout</span>
          </Link>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  )
}