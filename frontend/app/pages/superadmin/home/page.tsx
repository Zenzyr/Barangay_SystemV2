"use client";

import Link from "next/link";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { DataError, DataEmpty } from "@/components/ui/data-state-renderer";
import { Button } from "@/components/ui/button";


import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { accountInterface } from "@/app/types/account.type";
import type { LucideIcon } from "lucide-react";
import {
  ShieldCheck,
  Users,
  UserRoundCheck,
  UserCog,
  ClipboardList,
  Landmark,
  MapPin,
  FileText,
  SlidersHorizontal,
  Settings2,
  BarChart3,
  ChartPie,
  Sparkles,
  ScrollText,
  ChevronRight,
  TriangleAlert,
} from "lucide-react";

interface Stat {
  label: string;
  value: number | null;
  href: string;
  icon: LucideIcon;
}

interface ManageItem {
  title: string;
  desc: string;
  href: string;
  icon: LucideIcon;
}

const MANAGEMENT_ITEMS: ManageItem[] = [
  { title: "Users & Roles", desc: "Accounts, roles, status and verification", href: "/pages/superadmin/users", icon: Users },
  { title: "Residents", desc: "Resident census records", href: "/pages/secretary/residentCensus", icon: UserRoundCheck },
  { title: "Officials", desc: "Barangay officials directory", href: "/pages/secretary/barangaySettings/officials", icon: Landmark },
  { title: "Puroks", desc: "Purok directory", href: "/pages/secretary/barangaySettings/puroks", icon: MapPin },
  { title: "Document Templates", desc: "Design fees, formats and layouts", href: "/pages/secretary/document-templates", icon: FileText },
  { title: "Settings", desc: "Barangay configuration", href: "/pages/secretary/barangaySettings", icon: Settings2 },
];

const MONITORING_ITEMS: ManageItem[] = [
  { title: "Analytics", desc: "Community trends and insights", href: "/pages/secretary/analytics", icon: BarChart3 },
  { title: "Decision Support", desc: "Insights and recommendations", href: "/pages/secretary/decisionSupport", icon: Sparkles },
  { title: "Audit Trail", desc: "System activity log", href: "/pages/secretary/barangaySettings/audit", icon: ScrollText },
];

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </h2>
  );
}

function ManagementCard({ title, items }: { title: string; items: ManageItem[] }) {
  return (
    <DashboardCard title={title}>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              <item.icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-slate-700">{item.title}</span>
              <span className="block truncate text-xs text-slate-400">{item.desc}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </DashboardCard>
  );
}

export default function SuperAdminHomePage() {
  const { data: accounts = [], isLoading, isError, refetch } = useQuery<accountInterface[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await axiosInstance.get("/account")).data,
  });

  const stats = {
    total: accounts.length,
    residents: accounts.filter((a) => a.role === "resident").length,
    secretaries: accounts.filter((a) => a.role === "secretary").length,
    pending: accounts.filter((a) => a.status === "pending").length,
  };

  const pendingAccountIs = (a: accountInterface) =>
    a.possibleDuplicate?.status === "review";

  const pendingList = accounts
    .filter((a) => a.status === "pending")
    .sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 6);

  const STATS: Stat[] = [
    { label: "Total Accounts", value: stats.total, href: "/pages/superadmin/users", icon: Users },
    { label: "Residents", value: stats.residents, href: "/pages/superadmin/users?tab=residents", icon: UserRoundCheck },
    { label: "Secretaries", value: stats.secretaries, href: "/pages/superadmin/users?tab=secretaries", icon: UserCog },
    { label: "Pending Verification", value: stats.pending, href: "/pages/superadmin/users?tab=pending", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen">
      <div className="fixed inset-0 pointer-events-none bg-ambient-pattern opacity-10" />

      <div className="w-full space-y-6 p-4 sm:p-6">
      {/* ── Header ── */}
      <header className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
          <ShieldCheck className="size-4" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            Super Admin Dashboard
          </h1>
          <p className="text-xs text-slate-500">System overview and configuration hub</p>
        </div>
      </header>

      {/* ── System Overview ── */}
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <SectionHeading>System Overview</SectionHeading>
        </div>
        {isError ? (
          <div className="py-6">
            <DataError message="Failed to load system statistics" refetch={refetch} />
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-slate-100 lg:grid-cols-4 lg:divide-x">
            {STATS.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-slate-50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  <stat.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  {isLoading ? (
                    <Skeleton className="h-6 w-10" />
                  ) : (
                    <span className="block text-xl font-semibold tabular-nums text-slate-900">
                      {stat.value}
                    </span>
                  )}
                  <span className="block truncate text-xs text-slate-500">{stat.label}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── System Management + Monitoring & Insights ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ManagementCard title="System Management" items={MANAGEMENT_ITEMS} />
        <div className="space-y-4">
          <ManagementCard title="Monitoring & Insights" items={MONITORING_ITEMS} />
        </div>
      </div>

      {/* ── Pending Resident Verification ── */}
      <section className="glass-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Pending Resident Verification
            </h3>
            {!isLoading && stats.pending > 0 && (
              <p className="text-xs text-slate-500">
                {stats.pending} registration{stats.pending === 1 ? "" : "s"} awaiting review
              </p>
            )}
          </div>
          {stats.pending > 0 && (
            <Link
              href="/pages/superadmin/users?tab=pending"
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View all
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <div className="p-6">
            <DataError message="Failed to load pending verifications" refetch={refetch} />
          </div>
        ) : pendingList.length === 0 ? (
          <div className="p-6">
            <DataEmpty
              title="No Pending Verifications"
              description="No residents are currently awaiting verification."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Date / Time</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <p className="truncate font-medium text-slate-800">{a.name}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        Pending Verification
                      </span>
                      {pendingAccountIs(a) && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-rose-600">
                          <TriangleAlert className="size-3" />
                          Possible duplicate
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2.5 text-xs text-slate-500 sm:table-cell">
                      {formatDate(a.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/pages/superadmin/users?tab=pending&focus=${a._id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Review
                        <ChevronRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}