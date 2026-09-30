"use client";

import { useQuery } from "@tanstack/react-query";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { DataError, DataEmpty } from "@/components/ui/data-state-renderer";
import { Button } from "@/components/ui/button";


import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Clock,
  Loader2,
  CheckCircle2,
  FileCheck,
  ClipboardList,
  Inbox,
  Wrench,
  Star,
  ArrowUpRight,
  UserRound,
  ShieldCheck,
  BadgeCheck,
  Activity,
  LogIn,
  Briefcase,
  Camera,
  KeyRound,
  CalendarDays,
  Ban,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface UserActivity {
  _id: string;
  accountId: string;
  activity: string;
  date: string;
}

// ─── Document display names ──────────────────────────────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  certificateOfLowIncome: "Certificate of Low Income",
  endorsementLetter: "Endorsement Letter",
};

// ─── Status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string; border: string }
> = {
  pending: { label: "Pending", icon: Clock, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  processing: { label: "Processing", icon: Loader2, bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  ready: { label: "Ready", icon: BadgeCheck, bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  released: { label: "Released", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  cancelled: { label: "Cancelled", icon: Ban, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  "to claim": { label: "To Claim", icon: FileCheck, bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  completed: { label: "Completed", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
};

// ─── Format date ─────────────────────────────────────────────────
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatActivityDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) +
      " · " + date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

function getActivityIcon(activity: string) {
  const iconMap: Record<string, { icon: React.ElementType; bg: string; iconColor: string }> = {
    login: { icon: LogIn, bg: "bg-sky-100", iconColor: "text-sky-600" },
    "document request": { icon: FileText, bg: "bg-violet-100", iconColor: "text-violet-600" },
    review: { icon: Star, bg: "bg-amber-100", iconColor: "text-amber-600" },
    skill: { icon: Briefcase, bg: "bg-emerald-100", iconColor: "text-emerald-600" },
    profile: { icon: Camera, bg: "bg-pink-100", iconColor: "text-pink-600" },
    password: { icon: KeyRound, bg: "bg-red-100", iconColor: "text-red-600" },
    status: { icon: ShieldCheck, bg: "bg-teal-100", iconColor: "text-teal-600" },
  };
  const key = Object.keys(iconMap).find((k) => activity.toLowerCase().includes(k));
  return key ? iconMap[key] : { icon: Activity, bg: "bg-gray-100", iconColor: "text-gray-600" };
}

export default function Page() {
  const { user } = useUserStore();

  // ── Fetch this resident's document requests ──────────────────
  const { data: documents, isLoading: docsLoading, isError: docsError, refetch: refetchDocs } = useQuery<documentRequestInterface[]>({
    queryKey: ["document-requests", "resident", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/document-request/resident/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  // ── Fetch recent activity ─────────────────────────────────────
  const { data: activity, isLoading: activityLoading, isError: activityError, refetch: refetchActivity } = useQuery<UserActivity[]>({
    queryKey: ["activity", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/account/activity/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  const stats = {
    total: documents?.length || 0,
    pending: documents?.filter((d) => d.status === "pending").length || 0,
    processing: documents?.filter((d) => d.status === "processing").length || 0,
    ready: documents?.filter((d) => d.status === "ready" || d.status === "to claim").length || 0,
    released: documents?.filter((d) => d.status === "released" || d.status === "completed").length || 0,
    cancelled: documents?.filter((d) => d.status === "cancelled").length || 0,
  };

  const recentDocs = documents
    ? [...documents].sort((a, b) => (a._id < b._id ? 1 : -1)).slice(0, 4)
    : [];

  const recentActivity = activity
    ? [...activity].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5)
    : [];

  const STATS_CARDS = [
    { label: "Total Requests", value: stats.total, icon: ClipboardList, bg: "bg-sky-50", text: "text-sky-700", iconBg: "bg-sky-100", iconColor: "text-sky-600" },
    { label: "Pending", value: stats.pending, icon: Clock, bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
    { label: "Ready", value: stats.ready, icon: BadgeCheck, bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    { label: "Released", value: stats.released, icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  ];

  const QUICK_LINKS = [
    { title: "Request a Document", desc: "Apply for barangay certificates & clearances", href: "/pages/resident/documentRequest", icon: FileText, color: "text-sky-600", bg: "bg-sky-50" },
    { title: "My Profile", desc: "View and update your personal information", href: "/pages/resident/profile", icon: UserRound, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Resident Skills", desc: "Browse or offer skills in the community", href: "/pages/resident/residentSkills", icon: Wrench, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* Ambient Background Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-ambient-pattern opacity-10" />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0">
            <UserRound className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Here&apos;s an overview of your account</p>
          </div>
        </div>
        {user?.status && (
          <div
            className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 border ${
              user.status === "approved"
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : user.status === "pending"
                ? "bg-amber-50 text-amber-700 border-amber-100"
                : "bg-rose-50 text-rose-700 border-rose-100"
            }`}
          >
            <BadgeCheck className="size-4" />
            <span>
              Account status: <strong className="capitalize">{user.status}</strong>
            </span>
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {STATS_CARDS.map((stat) => (
          <div key={stat.label} className={`rounded-2xl border border-gray-200 p-4 ${stat.bg}`}>
            <div className="flex items-center justify-between mb-2">
              <div className={`size-8 rounded-lg flex items-center justify-center ${stat.iconBg}`}>
                <stat.icon className={`size-4 ${stat.iconColor}`} />
              </div>
            </div>
            {docsLoading ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <p className={`text-2xl font-bold ${stat.text}`}>{stat.value}</p>
            )}
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Recent Document Requests ── */}
        <div className="lg:col-span-2 glass-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/50">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="size-4 text-sky-600" />
              Recent Document Requests
            </h2>
            <Link
              href="/pages/resident/myDocuments"
              className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {docsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4">
                  <Skeleton className="h-4 w-40 mb-2" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))
            ) : docsError ? (
              <DataError message="Unable to load document requests" refetch={refetchDocs} />
            ) : recentDocs.length === 0 ? (
              <DataEmpty
                title="No Document Requests"
                description="You haven't submitted a document request yet."
                icon={Inbox}
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/pages/resident/documentRequest">Request a Document</Link>
                  </Button>
                }
              />
            ) : (
              recentDocs.map((doc) => {
                const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                return (
                  <div key={doc._id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {DOCUMENT_NAMES[doc.document] || doc.document}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <CalendarDays className="size-3" />
                        {formatDate(doc.dateIssued || doc._id)}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0 ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <cfg.icon className="size-3" />
                      {cfg.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <DashboardCard
          title="Recent Activity"
          icon={Activity}
          headerAction={
            <Link
              href="/pages/resident/activity"
              className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
            >
              View all <ArrowUpRight className="size-3" />
            </Link>
          }
        >
          <div className="divide-y divide-gray-100">
            {activityLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3.5">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))
            ) : activityError ? (
              <DataError message="Unable to load recent activity" refetch={refetchActivity} />
            ) : recentActivity.length === 0 ? (
              <DataEmpty
                title="No activity yet"
                description="Your recent actions will appear here."
                icon={Activity}
              />
            ) : (
              recentActivity.map((act) => {
                const { icon: Icon, bg, iconColor } = getActivityIcon(act.activity);
                return (
                  <div key={act._id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className={`size-7 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                      <Icon className={`size-3.5 ${iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{act.activity}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatActivityDate(act.date)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DashboardCard>
      </div>

      {/* ── Quick Links ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.title}
            href={link.href}
            className="group flex items-start gap-3 glass-card p-4 hover:border-sky-300 hover:shadow-md transition-all"
          >
            <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${link.bg}`}>
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
