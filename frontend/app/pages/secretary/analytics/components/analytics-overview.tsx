"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { accountInterface } from "@/app/types/account.type";
import { getDocumentPrice } from "@/app/utils/documents";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  Clock,
  Wallet,
  CheckCircle2,
  UserPlus2,
  CalendarDays,
  FileText,
  PieChart as PieChartIcon,
  ArrowUpRight,
  Users,
} from "lucide-react";

interface ChartTooltipPayloadItem {
  name?: string;
  value?: string | number;
  color?: string;
  payload?: { fill?: string };
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
}

// ─── Constants ──────────────────────────────────────────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Clearance",
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

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  processing: "#0ea5e9",
  "to claim": "#8b5cf6",
  completed: "#10b981",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  "to claim": "To Claim",
  completed: "Completed",
};

const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  approved: "#10b981",
  pending: "#f59e0b",
  rejected: "#ef4444",
};

const CHART_COLORS = [
  "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ────────────────────────────────────────────────────
function dateFromObjectId(id: string): Date {
  const timestamp = parseInt(id.substring(0, 8), 16) * 1000;
  return new Date(timestamp);
}

function formatPeso(n: number): string {
  return `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-md px-3 py-2 text-sm">
        <p className="font-semibold text-gray-900">{label}</p>
        {payload.map((entry: ChartTooltipPayloadItem, index: number) => (
          <p key={index} style={{ color: entry.color || entry.payload?.fill }} className="font-medium">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function AnalyticsOverview({
  from = null,
  rangeLabel = "All time",
}: {
  from?: Date | null;
  rangeLabel?: string;
}) {
  // ── Fetch all document requests & accounts ─────────────────────
  const { data: allDocs, isLoading: docsLoading } = useQuery<documentRequestInterface[]>({
    queryKey: ["document-requests", "analytics", "all"],
    queryFn: async () => {
      const res = await axiosInstance.get("/document-request");
      return res.data;
    },
  });

  const { data: allAccounts, isLoading: accountsLoading } = useQuery<accountInterface[]>({
    queryKey: ["accounts", "analytics", "all"],
    queryFn: async () => {
      const res = await axiosInstance.get("/account");
      return res.data;
    },
  });

  const isLoading = docsLoading || accountsLoading;

  // ── Core computations (respecting the shared date-range filter) ─
  const docs = useMemo(() => {
    const all = allDocs || [];
    if (!from) return all;
    const fromMs = from.getTime();
    return all.filter((d) => dateFromObjectId(d._id).getTime() >= fromMs);
  }, [allDocs, from]);

  const accounts = useMemo(() => {
    const all = allAccounts || [];
    if (!from) return all;
    const fromMs = from.getTime();
    return all.filter((a) => dateFromObjectId(a._id).getTime() >= fromMs);
  }, [allAccounts, from]);

  const now = useMemo(() => new Date(), []);

  const summary = useMemo(() => {
    const total = docs.length;
    const completed = docs.filter((d) => d.status === "completed").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const revenueCollected = docs
      .filter((d) => d.isPaid)
      .reduce((sum, d) => sum + getDocumentPrice(d.document), 0);

    const pendingRevenue = docs
      .filter((d) => !d.isPaid && d.status !== "completed")
      .reduce((sum, d) => sum + getDocumentPrice(d.document), 0);

    const unpaidCount = docs.filter((d) => !d.isPaid && d.status !== "completed").length;

    return { total, completed, completionRate, revenueCollected, pendingRevenue, unpaidCount };
  }, [docs]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, processing: 0, "to claim": 0, completed: 0 };
    docs.forEach((d) => {
      if (counts[d.status] !== undefined) counts[d.status]++;
    });
    return Object.entries(counts).map(([status, value]) => ({
      name: STATUS_LABELS[status] || status,
      status,
      value,
    }));
  }, [docs]);

  const popularDocuments = useMemo(() => {
    const counts: Record<string, number> = {};
    docs.forEach((d) => {
      counts[d.document] = (counts[d.document] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([doc, count]) => ({ name: DOCUMENT_NAMES[doc] || doc, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [docs]);

  // Requests per day for the last 14 days
  const requestTrend = useMemo(() => {
    const days: { key: string; label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }), count: 0 });
    }
    const map = new Map(days.map((d) => [d.key, d]));
    docs.forEach((d) => {
      const date = dateFromObjectId(d._id);
      const key = date.toISOString().slice(0, 10);
      const entry = map.get(key);
      if (entry) entry.count++;
    });
    return days;
  }, [docs, now]);

  // Peak day of week
  const weekdayDistribution = useMemo(() => {
    const counts = new Array(7).fill(0);
    docs.forEach((d) => {
      const date = dateFromObjectId(d._id);
      counts[date.getDay()]++;
    });
    return WEEKDAYS.map((label, i) => ({ name: label, count: counts[i] }));
  }, [docs]);

  const peakDay = useMemo(() => {
    if (weekdayDistribution.every((d) => d.count === 0)) return null;
    return weekdayDistribution.reduce((max, d) => (d.count > max.count ? d : max), weekdayDistribution[0]);
  }, [weekdayDistribution]);

  // Week-over-week trend
  const weekTrend = useMemo(() => {
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);

    let thisWeek = 0;
    let lastWeek = 0;
    docs.forEach((d) => {
      const date = dateFromObjectId(d._id);
      if (date >= thisWeekStart && date <= now) thisWeek++;
      else if (date >= lastWeekStart && date < thisWeekStart) lastWeek++;
    });

    const change = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
    return { thisWeek, lastWeek, change };
  }, [docs, now]);

  // Backlog: pending/processing requests older than 3 days
  const backlog = useMemo(() => {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - 3);
    return docs.filter(
      (d) => (d.status === "pending" || d.status === "processing") && dateFromObjectId(d._id) < threshold
    );
  }, [docs, now]);

  // Resident registrations - last 8 weeks
  const residentTrend = useMemo(() => {
    const weeks: { key: string; label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(start.getDate() - i * 7);
      weeks.push({ key: `w${i}`, label: start.toLocaleDateString("en-PH", { month: "short", day: "numeric" }), count: 0 });
    }
    accounts.forEach((a) => {
      const date = dateFromObjectId(a._id);
      const diffWeeks = Math.floor((now.getTime() - date.getTime()) / (7 * 24 * 60 * 60 * 1000));
      const idx = 7 - diffWeeks;
      if (idx >= 0 && idx < weeks.length) weeks[idx].count++;
    });
    return weeks;
  }, [accounts, now]);

  const residentStatusBreakdown = useMemo(() => {
    const counts: Record<string, number> = { approved: 0, pending: 0, rejected: 0 };
    accounts.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status]++;
    });
    return Object.entries(counts).map(([status, value]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      status,
      value,
    }));
  }, [accounts]);

  const pendingResidents = residentStatusBreakdown.find((r) => r.status === "pending")?.value || 0;

  // ── Decision-support insights ───────────────────────────────────
  const insights = useMemo(() => {
    const items: { tone: "warning" | "info" | "positive"; icon: React.ElementType; text: string; href?: string }[] = [];

    if (backlog.length > 0) {
      items.push({
        tone: "warning",
        icon: AlertTriangle,
        text: `${backlog.length} request${backlog.length !== 1 ? "s have" : " has"} been pending 3+ days without action — review the queue to avoid delays.`,
        href: "/pages/secretary/documentRequest",
      });
    }

    if (summary.unpaidCount > 0) {
      items.push({
        tone: "warning",
        icon: Wallet,
        text: `${formatPeso(summary.pendingRevenue)} in unpaid fees across ${summary.unpaidCount} active request${summary.unpaidCount !== 1 ? "s" : ""} — follow up with residents before releasing documents.`,
        href: "/pages/secretary/documentRequest",
      });
    }

    if (pendingResidents > 0) {
      items.push({
        tone: "warning",
        icon: UserPlus2,
        text: `${pendingResidents} resident${pendingResidents !== 1 ? "s are" : " is"} awaiting ID verification — clearing this backlog lets them request documents.`,
        href: "/pages/secretary/verifyResident",
      });
    }

    if (popularDocuments.length > 0) {
      const top = popularDocuments[0];
      const pct = summary.total > 0 ? Math.round((top.count / summary.total) * 100) : 0;
      items.push({
        tone: "info",
        icon: Lightbulb,
        text: `"${top.name}" is your most requested document (${top.count} requests, ${pct}% of all requests) — keep templates and requirements ready to speed up processing.`,
      });
    }

    if (peakDay && peakDay.count > 0) {
      items.push({
        tone: "info",
        icon: CalendarDays,
        text: `Requests peak on ${peakDay.name}s (${peakDay.count} historically) — plan front-desk coverage accordingly.`,
      });
    }

    if (summary.total >= 4) {
      if (weekTrend.change > 10) {
        items.push({
          tone: "info",
          icon: TrendingUp,
          text: `Requests are up ${weekTrend.change}% this week (${weekTrend.thisWeek}) vs last week (${weekTrend.lastWeek}) — consider preparing extra processing capacity.`,
        });
      } else if (weekTrend.change < -10) {
        items.push({
          tone: "info",
          icon: TrendingDown,
          text: `Requests are down ${Math.abs(weekTrend.change)}% this week (${weekTrend.thisWeek}) vs last week (${weekTrend.lastWeek}).`,
        });
      }
    }

    if (summary.total >= 5 && summary.completionRate < 50) {
      items.push({
        tone: "warning",
        icon: Clock,
        text: `Only ${summary.completionRate}% of requests reach completion — review where requests are stalling in the pipeline.`,
        href: "/pages/secretary/documentRequest",
      });
    } else if (summary.total >= 5 && summary.completionRate >= 80) {
      items.push({
        tone: "positive",
        icon: CheckCircle2,
        text: `${summary.completionRate}% of requests reach completion — the request pipeline is running smoothly.`,
      });
    }

    return items;
  }, [backlog, summary, pendingResidents, popularDocuments, peakDay, weekTrend]);

  const TONE_STYLES = {
    warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
    info: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800", iconBg: "bg-sky-100", iconColor: "text-sky-600" },
    positive: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  };

  return (
    <div className="w-full space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-slate-200/80 p-4 bg-sky-50 shadow-sm">
          <div className="flex items-center gap-2 text-sky-600 mb-1">
            <FileText className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Total Requests</span>
          </div>
          {isLoading ? <Skeleton className="h-7 w-14" /> : <p className="text-2xl font-bold text-sky-700">{summary.total}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200/80 p-4 bg-emerald-50 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-1">
            <Wallet className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Revenue Collected</span>
          </div>
          {isLoading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold text-emerald-700">{formatPeso(summary.revenueCollected)}</p>}
        </div>
        <div className="rounded-2xl border border-slate-200/80 p-4 bg-violet-50 shadow-sm">
          <div className="flex items-center gap-2 text-violet-600 mb-1">
            <CheckCircle2 className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Completion Rate</span>
          </div>
          {isLoading ? <Skeleton className="h-7 w-14" /> : <p className="text-2xl font-bold text-violet-700">{summary.completionRate}%</p>}
        </div>
        <div className="rounded-2xl border border-slate-200/80 p-4 bg-amber-50 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            {weekTrend.change >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
            <span className="text-xs font-medium uppercase tracking-wider text-gray-500">This Week vs Last</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            <p className="text-2xl font-bold text-amber-700 flex items-center gap-1">
              {weekTrend.change > 0 ? "+" : ""}
              {weekTrend.change}%
            </p>
          )}
        </div>
      </div>

      {/* ── Insights ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <Lightbulb className="size-4" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">Insights &amp; Recommendations</h2>
          </div>
          {rangeLabel !== "All time" && (
            <span className="text-xs font-medium text-gray-400">Showing: {rangeLabel}</span>
          )}
        </div>
        <div className="p-4 space-y-2.5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)
          ) : insights.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-8">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <CheckCircle2 className="size-6" />
              </div>
              <p className="text-sm font-medium">No urgent action needed right now</p>
              <p className="text-xs">Insights will appear here as request activity builds up</p>
            </div>
          ) : (
            insights.map((item, i) => {
              const style = TONE_STYLES[item.tone];
              const content = (
                <div className={`flex items-start gap-3 rounded-xl border p-3.5 ${style.bg} ${style.border}`}>
                  <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${style.iconBg}`}>
                    <item.icon className={`size-4 ${style.iconColor}`} />
                  </div>
                  <p className={`text-sm leading-snug ${style.text}`}>{item.text}</p>
                  {item.href && <ArrowUpRight className={`size-4 shrink-0 mt-0.5 ${style.iconColor}`} />}
                </div>
              );
              return item.href ? (
                <Link key={i} href={item.href} className="block hover:opacity-80 transition-opacity">
                  {content}
                </Link>
              ) : (
                <div key={i}>{content}</div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Charts Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Request Trend */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 lg:col-span-2 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <TrendingUp className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Request Trend (Last 14 Days)</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={requestTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="count" name="Requests" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: "#0ea5e9" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Popular Documents */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <BarChart3 className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Most Requested Documents</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : popularDocuments.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={popularDocuments} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10.5, fill: "#6b7280" }}
                    axisLine={false}
                    tickLine={false}
                    width={130}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Requests" radius={[0, 4, 4, 0]}>
                    {popularDocuments.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <BarChart3 className="size-5" />
              </div>
              <p className="text-sm">No requests yet</p>
            </div>
          )}
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <PieChartIcon className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Status Breakdown</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : statusBreakdown.some((d) => d.value > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                    {statusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#9ca3af"} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="bottom" height={36} formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <PieChartIcon className="size-5" />
              </div>
              <p className="text-sm">No requests yet</p>
            </div>
          )}
        </div>

        {/* Peak Day of Week */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <CalendarDays className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Requests by Day of Week</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayDistribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]} fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Payment Status</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : docs.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Paid", value: docs.filter((d) => d.isPaid).length },
                        { name: "Unpaid", value: docs.filter((d) => !d.isPaid).length },
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                    <Legend verticalAlign="bottom" height={30} formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-3">
                <span>Collected: <strong className="text-emerald-700">{formatPeso(summary.revenueCollected)}</strong></span>
                <span>Outstanding: <strong className="text-rose-700">{formatPeso(summary.pendingRevenue)}</strong></span>
              </div>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <Wallet className="size-5" />
              </div>
              <p className="text-sm">No requests yet</p>
            </div>
          )}
        </div>

        {/* Resident Growth */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <Users className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">New Residents (Last 8 Weeks)</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={residentTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="New Residents" radius={[4, 4, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Resident Verification Status */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <UserPlus2 className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Resident Verification Status</h3>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : residentStatusBreakdown.some((d) => d.value > 0) ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={residentStatusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" nameKey="name">
                    {residentStatusBreakdown.map((entry) => (
                      <Cell key={entry.status} fill={ACCOUNT_STATUS_COLORS[entry.status] || "#9ca3af"} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="bottom" height={36} formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <UserPlus2 className="size-5" />
              </div>
              <p className="text-sm">No residents yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}