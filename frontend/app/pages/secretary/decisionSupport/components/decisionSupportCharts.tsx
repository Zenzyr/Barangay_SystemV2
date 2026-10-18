"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DecisionSupportAnalysis } from "@/app/types/ai.type";

type Snapshot = DecisionSupportAnalysis["dataSnapshot"];

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

export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
        {label != null && label !== "" && <p className="font-semibold text-gray-900">{label}</p>}
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color || entry.payload?.fill }} className="font-medium">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export const SECTOR_RATE_LABELS: Record<string, string> = {
  unemploymentRateHeuristic: "Unemployment (heuristic)",
  outOfSchoolRateHeuristic: "Out-of-school (heuristic)",
  seniorCitizenRate: "Senior citizens",
  pwdRate: "PWD",
  youthRate: "Youth (15-30)",
  fourPsRate: "4Ps beneficiaries",
  soloParentRate: "Solo parents",
  hpnMaintenanceRate: "HPN maintenance",
  familyPlanningRate: "Family planning",
  lowIncomeHouseholdRate: "Low-income households",
};

const STATUS_LABELS: { key: string; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "#f59e0b" },
  { key: "processing", label: "Processing", color: "#0ea5e9" },
  { key: "ready", label: "Ready for release", color: "#8b5cf6" },
  { key: "toClaim", label: "To claim", color: "#8b5cf6" },
  { key: "completed", label: "Completed", color: "#10b981" },
  { key: "released", label: "Released", color: "#14b8a6" },
  { key: "rejected", label: "Rejected", color: "#ef4444" },
  { key: "cancelled", label: "Cancelled", color: "#94a3b8" },
];

const SECTOR_COLORS = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"];
const QUEUE_COLOR = "#f59e0b";
const COMMUNITY_COLOR = "#0ea5e9";

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5 ${className ?? ""}`}>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle ? <p className="text-xs text-gray-500">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-center text-gray-400">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-300">
        <BarChart3 className="size-5" />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  );
}

/**
 * Turns the numeric portion of a saved analysis snapshot into charts:
 * community profile, document-request status, sector rates and work queues.
 * Rate/day values stay as text in the KPI strip on the parent page.
 */
export function SnapshotCharts({ snapshot, loading }: { snapshot?: Snapshot; loading?: boolean }) {
  const community = snapshot?.community;
  const overview = snapshot?.overview;
  const rates = community?.sectorRates ?? {};

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const communityData = [
    { name: "Total residents", value: community?.totalResidents },
    { name: "Households", value: community?.totalHouseholds },
    { name: "Children (<15)", value: community?.children },
    { name: "Youth (15-30)", value: community?.youth },
  ].filter((row): row is { name: string; value: number } => isNumber(row.value));

  const sectorData = Object.entries(SECTOR_RATE_LABELS)
    .map(([key, name]) => ({ key, name, value: rates[key] }))
    .filter((row): row is { key: string; name: string; value: number } => isNumber(row.value))
    .sort((a, b) => b.value - a.value);

  const statusCounts = overview?.statusCounts;
  let statusData = STATUS_LABELS.map((s) => ({
    name: s.label,
    key: s.key,
    color: s.color,
    value: statusCounts ? Number((statusCounts as Record<string, number>)[s.key] ?? 0) : 0,
  })).filter((row) => row.value > 0);

  // Older snapshots have no statusCounts — fall back to completed vs outstanding.
  if (statusData.length === 0 && overview && isNumber(overview.totalRequests)) {
    const completed = overview.completedRequests ?? 0;
    const outstanding = Math.max(overview.totalRequests - completed, 0);
    statusData = [
      { name: "Completed", key: "completed", color: "#10b981", value: completed },
      { name: "Outstanding", key: "outstanding", color: "#f59e0b", value: outstanding },
    ].filter((row) => row.value > 0);
  }

  const queueData = [
    { name: "Backlog (>3 days)", value: overview?.backlogCount },
    { name: "Unpaid fees", value: overview?.unpaidCount },
    { name: "Counter-payments", value: overview?.counterPaymentCount },
    { name: "Payment verify queue", value: overview?.pendingVerificationCount },
    { name: "Blocked from release", value: overview?.blockedFromRelease },
    { name: "ID verification queue", value: overview?.pendingUsers },
  ].filter((row): row is { name: string; value: number } => isNumber(row.value));

  const queuesClear = queueData.length === 0 || queueData.every((row) => row.value === 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Community profile ── */}
      <ChartCard title="Community Profile" subtitle="Census residents by segment" icon={Users}>
        {communityData.length === 0 ? (
          <EmptyChart message="No community data in this snapshot" />
        ) : (
          <div className="h-56" role="img" aria-label="Bar chart of the community profile counts">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={communityData} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="26%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={104} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]} fill={COMMUNITY_COLOR}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "#334155" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* ── Document request status ── */}
      <ChartCard title="Document Requests" subtitle="Requests by status at the time of analysis" icon={PieChartIcon}>
        {statusData.length === 0 ? (
          <EmptyChart message="No document requests in this snapshot" />
        ) : (
          <div className="h-56" role="img" aria-label="Donut chart of document requests by status">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" nameKey="name">
                  {statusData.map((row) => (
                    <Cell key={row.key} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" height={32} formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* ── Sector rates ── */}
      {sectorData.length > 0 && (
        <ChartCard title="Community Sector Rates" subtitle="Share of residents in each sector" icon={BarChart3}>
          <div className="h-64" role="img" aria-label="Horizontal bar chart of community sector rates">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={sectorData} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, (max: number) => Math.max(10, Math.ceil(max / 10) * 10)]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis type="category" dataKey="name" width={142} tick={{ fontSize: 10.5, fill: "#475569" }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" name="Rate" radius={[0, 6, 6, 0]}>
                  {sectorData.map((row, index) => (
                    <Cell key={row.key} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fill: "#334155" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      {/* ── Work queues ── */}
      <ChartCard
        title="Operational Queues"
        subtitle="Items waiting on barangay staff"
        icon={BarChart3}
        className={sectorData.length > 0 ? "lg:col-span-2" : undefined}
      >
        {queuesClear ? (
          <EmptyChart message="No outstanding work queues" />
        ) : (
          <div className="h-56" role="img" aria-label="Horizontal bar chart of operational queue sizes">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={queueData} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap="24%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} interval={0} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" name="Items" radius={[0, 6, 6, 0]} fill={QUEUE_COLOR}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: "#334155" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
