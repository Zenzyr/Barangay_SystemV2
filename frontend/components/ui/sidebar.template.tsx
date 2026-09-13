"use client"
import Link from "next/link"
import { Calendar, Home, Building, Search, UserPlus2, User, FileText, BarChart3, Building2, LogOut, Menu, X, MenuIcon, Receipt, Recycle, Activity } from "lucide-react"
import { useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useQueryClient } from "@tanstack/react-query";

const navigationItems = [
  { title: "Dashboard", url: "/pages/admin/home", icon: Home },
  { title: "Employee", url: "/pages/admin/addEmployee", icon: UserPlus2 },
  { title: "Branch", url: "/pages/admin/addBranch", icon: Building },
  { title: "Products", url: "/pages/admin/products", icon: MenuIcon },
  { title: "Transactions", url: "/pages/admin/transactions", icon: Receipt },
  { title: "Activities", url: "/pages/admin/activities", icon: Activity },
  { title: "Waste", url: "/pages/admin/waste", icon: Recycle },
  { title: "Shift", url: "/pages/admin/shift", icon: Calendar },
]

const accountItems = [
  { title: "Logout", url: "/", icon: LogOut }
]

interface AppSidebarProps {
  className?: string
}

export function TestSideBar({ className }: AppSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)
  const closeMobileMenu = () => setIsMobileMenuOpen(false)
  const queryClient = useQueryClient();

  const logoutHandler = async () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
  };

  return (
    <>
      {/* ── Mobile Navbar ── */}
      <div className="lg:hidden bg-secondary text-text p-4 flex items-center justify-between fixed top-0 left-0 right-0 z-50 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="aspect-square size-8 overflow-hidden">
            <img src="/web/logo.jpg" alt="Logo" className="object-cover w-full h-full" />
          </div>
          <div className="flex flex-col">
            <span
              className="text-gold font-light tracking-[0.1em] uppercase text-sm"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              InkSight
            </span>
            <span className="text-[10px] text-text-muted tracking-[0.2em] uppercase">Admin</span>
          </div>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="p-2 border border-border bg-surface text-text-muted hover:text-gold hover:border-gold/40 transition-all duration-200"
        >
          {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* ── Mobile Sidebar Drawer ── */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-primary/80 backdrop-blur-sm"
          onClick={closeMobileMenu}
        >
          <div
            className="fixed top-0 left-0 w-64 h-full bg-secondary border-r border-border shadow-[4px_0_40px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute top-0 left-0 w-full h-40 bg-gold opacity-[0.04] blur-[60px]" />

            {/* Gold top corner */}
            <div className="absolute top-0 right-0 w-10 h-10 border-t border-r border-gold opacity-30" />

            <div className="pt-20 px-4 relative">
              {/* Nav section */}
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.28em] text-gold mb-3 flex items-center gap-2">
                  <span className="h-px w-4 bg-gold opacity-60" />
                  Section
                </p>
                <nav className="space-y-1">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.title}
                      href={item.url}
                      onClick={closeMobileMenu}
                      className="flex items-center gap-3 px-3 py-2.5 text-text-muted hover:text-text hover:bg-surface-alt border border-transparent hover:border-border transition-all duration-200 group"
                    >
                      <item.icon size={16} className="text-text-dim group-hover:text-gold transition-colors duration-200" />
                      <span className="text-sm tracking-[0.06em] font-light">{item.title}</span>
                    </Link>
                  ))}
                </nav>
              </div>

              {/* Logout */}
              <div className="absolute bottom-6 left-4 right-4 border-t border-border pt-4">
                {accountItems.map((item) => (
                  <Link
                    key={item.title}
                    href={item.url}
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-3 py-2.5 text-text-muted hover:text-danger-light hover:bg-danger-muted border border-transparent hover:border-danger-border transition-all duration-200 group"
                  >
                    <item.icon size={16} className="group-hover:text-danger-light transition-colors duration-200" />
                    <span className="text-sm tracking-[0.06em] font-light">{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <Sidebar className={`hidden lg:flex bg-secondary border-r border-border ${className}`}>

        {/* Header */}
        <SidebarHeader className="bg-secondary border-b border-border px-4 py-4 relative">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute top-0 left-0 w-full h-20 bg-gold opacity-[0.05] blur-[40px]" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="hover:bg-surface-alt rounded-none border border-transparent hover:border-border transition-all duration-200">
                <Link href="/">
                  <div className="aspect-square size-8 overflow-hidden border border-border">
                    <img src="/web/logo.jpg" alt="Logo" className="object-cover w-full h-full" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span
                      className="truncate text-gold font-light tracking-[0.1em] uppercase text-sm"
                      style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                    >
                      InkSight
                    </span>
                    <span className="truncate text-[10px] text-text-muted tracking-[0.2em] uppercase">
                      Admin
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        {/* Navigation */}
        <SidebarContent className="bg-secondary">
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.28em] text-gold px-4 py-3 flex items-center gap-2">
              <span className="h-px w-4 bg-gold opacity-60" />
              Section
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className="text-text-muted hover:text-text hover:bg-surface-alt rounded-none border border-transparent hover:border-border mx-2 transition-all duration-200 group [&_svg]:text-text-dim group-hover:[&_svg]:text-gold [&_svg]:transition-colors [&_svg]:duration-200"
                    >
                      <Link href={item.url} className="tracking-[0.04em] font-light text-sm">
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="bg-secondary border-t border-border">
          <SidebarMenu>
            {accountItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  className="text-text-muted hover:text-danger-light hover:bg-danger-muted rounded-none border border-transparent hover:border-danger-border mx-2 transition-all duration-200 group [&_svg]:transition-colors [&_svg]:duration-200 group-hover:[&_svg]:text-danger-light"
                >
                  <Link href={item.url} className="tracking-[0.04em] font-light text-sm">
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>
    </>
  )
}