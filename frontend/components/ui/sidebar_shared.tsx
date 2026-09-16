"use client"
import Link from "next/link"
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";

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
