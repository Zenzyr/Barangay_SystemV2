"use client"
import Link from "next/link"
import { usePathname , useRouter} from "next/navigation"
import {
  Home,
  BarChart3,
  Sparkles,
  UserPlus2,
  FileText,
  History,
  ClipboardList,
  Award,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Store,
  Landmark,
  MapPin,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { SidebarBrand } from "@/components/ui/sidebar_shared";

type NavLeaf = { title: string; url: string; icon: LucideIcon }
type NavGroupItem = { title: string; icon: LucideIcon; children: NavLeaf[] }
type NavItem = NavLeaf | NavGroupItem

const isNavGroup = (item: NavItem): item is NavGroupItem => "children" in item

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/pages/secretary/home", icon: Home },
  { title: "Analytics", url: "/pages/secretary/analytics", icon: BarChart3 },
  { title: "Decision Support", url: "/pages/secretary/decisionSupport", icon: Sparkles },
  { title: "Verify Resident", url: "/pages/secretary/verifyResident", icon: UserPlus2 },
  { title: "Document Requests", url: "/pages/secretary/documentRequest", icon: FileText },
  { title: "Request History", url: "/pages/secretary/requestHistory", icon: History },
  { title: "Resident Census", url: "/pages/secretary/residentCensus", icon: ClipboardList },
  { title: "Resident Skills", url: "/pages/secretary/residentSkills", icon: Award },
  {
    title: "Settings",
    icon: Settings,
    children: [
      { title: "Officials", url: "/pages/secretary/barangaySettings/officials", icon: Landmark },
      { title: "Puroks", url: "/pages/secretary/barangaySettings/puroks", icon: MapPin },
      { title: "Document Templates", url: "/pages/secretary/document-templates", icon: FileText },
      { title: "Audit Trail", url: "/pages/secretary/barangaySettings/audit", icon: ScrollText },
    ],
  },
]

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

interface AppSidebarProps {
  className?: string
}


export function SidebarSecretary({ className }: AppSidebarProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()

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
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-slate-200/50 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-md lg:hidden">
        <SidebarBrand subtitle="Secretary" href="/pages/secretary/home" />
        <SidebarTrigger />
      </div>

      {/* ── Desktop Sidebar ── */}
      <Sidebar
        className={cn(
          "hidden border-r border-slate-200/80 bg-white/95 shadow-sm lg:flex",
          className
        )}
      >
        <SidebarHeader className="border-b border-slate-100 px-4 py-5">
          <SidebarBrand subtitle="Secretary" href="/pages/secretary/home" />
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="scrollbar-thin overflow-y-auto px-3 py-4">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Menu
          </p>
          <nav className="space-y-1">
            {navigationItems.map((item) => {
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