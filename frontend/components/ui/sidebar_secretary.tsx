"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
  Store,
  Landmark,
  MapPin,
  ScrollText,
} from "lucide-react"
import { useState } from "react"
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

const navigationItems = [
  { title: "Dashboard", url: "/pages/secretary/home", icon: Home },
  { title: "Analytics", url: "/pages/secretary/analytics", icon: BarChart3 },
  { title: "Decision Support", url: "/pages/secretary/decisionSupport", icon: Sparkles },
  { title: "Verify Resident", url: "/pages/secretary/verifyResident", icon: UserPlus2 },
  { title: "Document Requests", url: "/pages/secretary/documentRequest", icon: FileText },
  { title: "Request History", url: "/pages/secretary/requestHistory", icon: History },
  { title: "Resident Census", url: "/pages/secretary/residentCensus", icon: ClipboardList },
  { title: "Resident Skills", url: "/pages/secretary/residentSkills", icon: Award },
  { title: "Officials", url: "/pages/secretary/barangaySettings/officials", icon: Landmark },
  { title: "Puroks", url: "/pages/secretary/barangaySettings/puroks", icon: MapPin },
  { title: "Document Templates", url: "/pages/secretary/document-templates", icon: FileText },
  { title: "Audit Trail", url: "/pages/secretary/barangaySettings/audit", icon: ScrollText },
]

interface AppSidebarProps {
  className?: string
}


export function SidebarSecretary({ className }: AppSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  const closeMobileMenu = () => setIsMobileMenuOpen(false)
  const queryClient = useQueryClient()
  const pathname = usePathname()

  const isActive = (url: string) =>
    pathname === url || pathname.startsWith(`${url}/`)

  const logoutHandler = async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
  };

  return (
    <>
      {/* ── Mobile Navbar ── */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-slate-200/50 bg-white/50 px-4 py-3 shadow-sm backdrop-blur-md lg:hidden">
        <SidebarBrand subtitle="Secretary" href="/pages/secretary/home" />
        <button
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
        >
          {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={closeMobileMenu}
        >
          <div
            className="flex h-full w-72 max-w-[85vw] flex-col bg-white/70 backdrop-blur-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
              <SidebarBrand
                subtitle="Secretary"
                href="/pages/secretary/home"
                onNavigate={closeMobileMenu}
              />
              <button
                onClick={closeMobileMenu}
                aria-label="Close menu"
                className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navigationItems.map((item) => {
                const active = isActive(item.url)
                return (
                  <Link
                    key={item.title}
                    href={item.url}
                    onClick={closeMobileMenu}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
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
              })}
            </nav>

            <div className="border-t border-slate-100 p-3">
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  logoutHandler();
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-rose-50/70 px-3 py-2.5 text-sm font-medium text-rose-600 transition-all duration-200 hover:bg-rose-100/80 hover:text-rose-700"
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
              const active = isActive(item.url)
              return (
                <Link
                  key={item.title}
                  href={item.url}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
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