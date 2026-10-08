"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, LogOut, type LucideIcon } from "lucide-react"
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import useUserStore from "@/app/store/useUserStore";
import { Permission, hasPermission } from "@/lib/constants/roles";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils";

export function SidebarBrand({
  subtitle,
  href,
  role,
  onNavigate,
}: {
  subtitle: string
  href: string
  role?: string
  onNavigate?: () => void
}) {
  const settings = useBarangaySettingsStore((s) => s.settings);
  const name =
    settings?.barangay?.name || "Barangay Rabon";
  const logo = settings?.barangay?.logoUrl || "/assets/logo.jpg";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group flex items-center gap-3"
    >
      <div className="relative size-10 shrink-0 overflow-hidden rounded-xl shadow-sm ring-2 ring-sky-100 transition-all duration-300 group-hover:ring-sky-300">
        <img src={logo} alt="Logo" className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold tracking-tight text-slate-800">
          {name}
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600/80">
          {subtitle} Portal
        </span>
        {role && (
          <span className="block truncate text-[10px] font-medium text-slate-400">
            {role}
          </span>
        )}
      </div>
    </Link>
  )
}

export type NavLeaf = { title: string; url: string; icon: LucideIcon; permission?: Permission }
export type NavGroupItem = { title: string; icon: LucideIcon; children: NavLeaf[] }
export type NavItem = NavLeaf | NavGroupItem

const isNavGroup = (item: NavItem): item is NavGroupItem => "children" in item

function NavLink({
  item,
  active,
  onNavigate,
  textSizeClass,
  indented,
}: {
  item: NavLeaf
  active: boolean
  onNavigate?: () => void
  textSizeClass: string
  indented?: boolean
}) {
  return (
    <Link
      href={item.url}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-all duration-200",
        textSizeClass,
        indented && "py-2 pl-9",
        active
          ? "bg-gradient-to-r from-sky-50 to-emerald-50 text-sky-700 shadow-sm ring-1 ring-sky-100"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <item.icon
        className={cn(
          "size-4 shrink-0 transition-colors duration-200",
          active ? "text-emerald-600" : "text-slate-400"
        )}
      />
      <span className="flex-1">{item.title}</span>
      {active && <ChevronRight className="size-3.5 text-emerald-500" />}
    </Link>
  )
}

function NavGroup({
  item,
  isActive,
  onNavigate,
  textSizeClass,
}: {
  item: NavGroupItem
  isActive: (url: string) => boolean
  onNavigate?: () => void
  textSizeClass: string
}) {
  const hasActiveChild = item.children.some((child) => isActive(child.url))
  const [manuallyOpen, setManuallyOpen] = useState(false)
  const open = hasActiveChild || manuallyOpen

  return (
    <div>
      <button
        type="button"
        onClick={() => setManuallyOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-all duration-200",
          textSizeClass,
          hasActiveChild
            ? "text-sky-700"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <item.icon
          className={cn(
            "size-4 shrink-0 transition-colors duration-200",
            hasActiveChild ? "text-emerald-600" : "text-slate-400"
          )}
        />
        <span className="flex-1 text-left">{item.title}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-slate-400 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {item.children.map((child) => (
            <NavLink
              key={child.title}
              item={child}
              active={isActive(child.url)}
              onNavigate={onNavigate}
              textSizeClass={textSizeClass}
              indented
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function StaffSidebar({
  className,
  subtitle,
  homeHref,
  items,
}: {
  className?: string
  subtitle: string
  homeHref: string
  items: NavItem[]
}) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const role = useUserStore((s) => s.user?.role)
  const allowed = (leaf: NavLeaf) => !leaf.permission || hasPermission(role, leaf.permission)
  const visibleItems = items
    .map((item) => (isNavGroup(item) ? { ...item, children: item.children.filter(allowed) } : item))
    .filter((item) => (isNavGroup(item) ? item.children.length > 0 : allowed(item)))

  const isActive = (url: string) =>
    pathname === url || pathname.startsWith(`${url}/`)

  const logoutHandler = async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    router.replace("/");
  };

  return (
    <>
      {/* ── Mobile Navbar ── */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-slate-200/50 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-md md:hidden">
        <SidebarBrand subtitle={subtitle} href={homeHref} />
        <SidebarTrigger />
      </div>

      {/* ── Desktop Sidebar ── */}
      <Sidebar
        className={cn(
          "hidden border-r border-slate-200/80 bg-white/95 shadow-sm md:flex",
          className
        )}
      >
        <SidebarHeader className="border-b border-slate-100 px-4 py-5">
          <SidebarBrand subtitle={subtitle} href={homeHref} />
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="scrollbar-thin overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Menu
          </p>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              if (isNavGroup(item)) {
                return (
                  <NavGroup
                    key={item.title}
                    item={item}
                    isActive={isActive}
                    textSizeClass="text-[13px]"
                  />
                )
              }
              return (
                <NavLink
                  key={item.title}
                  item={item}
                  active={isActive(item.url)}
                  textSizeClass="text-[13px]"
                />
              )
            })}
          </nav>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="border-t border-slate-100 p-4">
          <Link
            href="/"
            onClick={logoutHandler}
            className="flex items-center gap-3 rounded-xl bg-rose-50/70 px-3 py-2.5 text-[13px] font-medium text-rose-600 transition-all duration-200 hover:bg-rose-100/80 hover:text-rose-700"
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