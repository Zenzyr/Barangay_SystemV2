"use client"

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { accountInterface } from "@/app/types/account.type";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Clock,
  Loader2,
  CheckCircle2,
  FileCheck,
  ClipboardList,
  Inbox,
  UserPlus2,
  Users,
  Award,
  ArrowUpRight,
  UserRound,
  History,
  CalendarDays,
  Wallet,
  LayoutDashboard,
  BarChart3,
} from "lucide-react";

// ─── Document display names ──────────────────────────────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  certificateOfGoodMoralCharacter: "Certificate of Good Moral Character",
  certificateOfUnemployment: "Certificate of Unemployment",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  certificateOfLowIncome: "Certificate of Low Income",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  endorsementLetter: "Endorsement Letter",
};

// ─── Status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string; border: string }
> = {
  pending: { label: "Pending", icon: Clock, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  processing: { label: "Processing", icon: Loader2, bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  "to claim": { label: "To Claim", icon: FileCheck, bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  completed: { label: "Completed", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function Page() {
  // ── Active (non-completed) document requests ──────────────────
  const { data: activeDocs, isLoading: activeLoading } = useQuery<documentRequestInterface[]>({
    queryKey: ["document-requests", "secretary", "active"],
    queryFn: async () => {
      const res = await axiosInstance.get("/document-request", { params: { statusNot: "completed" } });
      return res.data;
    },
  });

  // ── Completed document requests (for stats) ────────────────────
  const { data: completedDocs, isLoading: completedLoading } = useQuery<documentRequestInterface[]>({
    queryKey: ["document-requests", "secretary", "completed"],
    queryFn: async () => {
      const res = await axiosInstance.get("/document-request", { params: { status: "completed" } });
      return res.data;
    },
  });

  // ── Residents pending verification ─────────────────────────────
  const { data: pendingResidents, isLoading: pendingLoading } = useQuery<accountInterface[]>({
    queryKey: ["accounts", "pending"],
    queryFn: async () => {
      const res = await axiosInstance.get("/account", { params: { status: "pending" } });
      return res.data;
    },
  });

  // ── All accounts (for total resident count) ─────────────────────
  const { data: allAccounts, isLoading: allLoading } = useQuery<accountInterface[]>({
    queryKey: ["accounts", "all"],
    queryFn: async () => {
      const res = await axiosInstance.get("/account");
      return res.data;
    },
  });

  const stats = {
    pendingVerification: pendingResidents?.length || 0,
    totalResidents: allAccounts?.filter((a) => a.status === "approved").length || 0,
    activeRequests: activeDocs?.length || 0,
    pending: activeDocs?.filter((d) => d.status === "pending").length || 0,
    unpaid: activeDocs?.filter((d) => !d.isPaid).length || 0,
    completed: completedDocs?.length || 0,
  };

  const STATS_CARDS = [
    { label: "Pending Verification", value: stats.pendingVerification, icon: UserPlus2, bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100", iconColor: "text-amber-600", href: "/pages/secretary/verifyResident" },
    { label: "Approved Residents", value: stats.totalResidents, icon: Users, bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", href: "/pages/secretary/verifyResident" },
    { label: "Active Requests", value: stats.activeRequests, icon: ClipboardList, bg: "bg-sky-50", text: "text-sky-700", iconBg: "bg-sky-100", iconColor: "text-sky-600", href: "/pages/secretary/documentRequest" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100", iconColor: "text-violet-600", href: "/pages/secretary/requestHistory" },
  ];

  const isStatsLoading = pendingLoading || allLoading || activeLoading || completedLoading;

  const recentDocs = activeDocs
    ? [...activeDocs].sort((a, b) => (a._id < b._id ? 1 : -1)).slice(0, 5)
    : [];

  const recentResidents = pendingResidents
    ? [...pendingResidents].sort((a, b) => (a._id < b._id ? 1 : -1)).slice(0, 5)
    : [];

  const QUICK_LINKS = [
    { title: "Verify Residents", desc: "Review pending resident applications", href: "/pages/secretary/verifyResident", icon: UserPlus2, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Document Requests", desc: "Process and update request status", href: "/pages/secretary/documentRequest", icon: FileText, color: "text-sky-600", bg: "bg-sky-50" },
    { title: "Analytics", desc: "View trends and decision-support insights", href: "/pages/secretary/analytics", icon: BarChart3, color: "text-emerald-600", bg: "bg-emerald-50" },
  ];

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm">
              <LayoutDashboard className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                Secretary Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Overview of barangay residents and document requests</p>
            </div>
          </div>
        </div>
        {stats.pendingVerification > 0 && (
          <Link
            href="/pages/secretary/verifyResident"
            className="flex items-center gap-2 text-sm rounded-xl px-4 py-2 border bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 transition-colors"
          >
            <UserPlus2 className="size-4" />
            <span>
              <strong>{stats.pendingVerification}</strong> resident{stats.pendingVerification !== 1 ? "s" : ""} awaiting verification
            </span>
          </Link>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STATS_CARDS.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`rounded-2xl border border-slate-200/80 p-4 shadow-sm ${stat.bg} hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`size-8 rounded-xl flex items-center justify-center ${stat.iconBg}`}>
                <stat.icon className={`size-4 ${stat.iconColor}`} />
              </div>
            </div>
            {isStatsLoading ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <p className={`text-2xl font-bold ${stat.text}`}>{stat.value}</p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Recent Document Requests ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="size-4 text-sky-600" />
              Recent Document Requests
            </h2>
            <Link
              href="/pages/secretary/documentRequest"
              className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {activeLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4">
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))
            ) : recentDocs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-gray-400 py-12">
                <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                  <Inbox className="size-6" />
                </div>
                <p className="text-sm font-medium">No active requests</p>
              </div>
            ) : (
              recentDocs.map((doc) => {
                const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                return (
                  <div key={doc._id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-7 rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 flex items-center justify-center shrink-0">
                        <UserRound className="size-3.5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {doc.resident?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {DOCUMENT_NAMES[doc.document] || doc.document}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!doc.isPaid && (
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <Wallet className="size-3" />
                          Unpaid
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        <cfg.icon className={`size-3 ${doc.status === "processing" ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Residents Pending Verification ── */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <UserPlus2 className="size-4 text-sky-600" />
              Awaiting Verification
            </h2>
            <Link
              href="/pages/secretary/verifyResident"
              className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))
            ) : recentResidents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 text-gray-400 py-12">
                <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                  <CheckCircle2 className="size-6" />
                </div>
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs">No residents awaiting verification</p>
              </div>
            ) : (
              recentResidents.map((res) => (
                <div key={res._id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="size-7 rounded-full bg-gradient-to-br from-amber-100 to-sky-100 flex items-center justify-center shrink-0">
                    <UserRound className="size-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{res.name}</p>
                    <p className="text-xs text-gray-400 truncate">{res.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.title}
            href={link.href}
            className="group flex items-start gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 hover:border-sky-300 hover:shadow-md transition-all"
          >
            <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${link.bg}`}>
              <link.icon className={`size-5 ${link.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 group-hover:text-sky-700 transition-colors">
                {link.title}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
