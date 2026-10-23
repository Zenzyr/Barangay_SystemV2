"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgramEligibilityPanel } from "./programEligibilityPanel";
import { SnapshotCharts, ChartTooltip } from "./decisionSupportCharts";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DecisionSupportAnalysis,
  InsightItem,
  RecommendationFeedback,
  RecommendationFeedbackStatus,
  CalibrationResult,
  MetricOutcome,
} from "@/app/types/ai.type";
import {
  residentCountStatus,
  RESIDENT_COUNT_MATCH_MESSAGE,
  RESIDENT_COUNT_MISMATCH_MESSAGE,
} from "@/app/utils/residentCount";
import {
  Brain,
  Lightbulb,
  Target,
  ShieldAlert,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Clock,
  Loader2,
  RefreshCw,
  History,
  CalendarDays,
  UserRound,
  Play,
  Eye,
  Gauge,
  BarChart3,
  Minus,
  MessageSquareText,
  TrendingUp,
  Wallet,
} from "lucide-react";

type DSSection = "data" | "recommendations" | "insights" | "outcomes" | "benefits";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; iconBg: string; iconColor: string; label: string }> = {
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", iconBg: "bg-amber-100", iconColor: "text-amber-600", label: "Needs attention" },
  info: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-900", iconBg: "bg-sky-100", iconColor: "text-sky-600", label: "Watch" },
  positive: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", label: "Good sign" },
};

const PRIORITY_LABEL: Record<string, string> = {
  warning: "High",
  info: "Moderate",
  positive: "Low",
};

function InsightCard({ item, footer }: { item: InsightItem; footer?: React.ReactNode }) {
  const style = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info;
  const SeverityIcon = item.severity === "warning" ? AlertTriangle : item.severity === "positive" ? CheckCircle2 : Info;
  return (
    <div className={`rounded-xl border ${style.bg} ${style.border} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${style.iconBg} ${style.iconColor}`}>
            <SeverityIcon className="size-3.5" />
            {style.label}
          </span>
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{item.category}</span>
        </div>
        {item.priorityScore != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-bold text-gray-700" title={`Priority score (0-100)`}>
            <Gauge className="size-3.5 text-slate-400" />
            Priority {item.priorityScore}/100
          </span>
        )}
      </div>
      <p className={`text-base font-semibold ${style.text}`}>{item.title}</p>
      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className={`size-4 shrink-0 mt-0.5 ${style.iconColor}`} />
          <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold text-gray-800">Why: </span>{item.why}</p>
        </div>
        <div className="flex items-start gap-2">
          <Target className={`size-4 shrink-0 mt-0.5 text-sky-600`} />
          <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold text-gray-800">Action: </span>{item.action}</p>
        </div>
        {Array.isArray(item.evidence) && item.evidence.length > 0 && (
          <div className="flex items-start gap-2">
            <BarChart3 className="size-4 shrink-0 mt-0.5 text-slate-400" />
            <div className="text-sm text-gray-600 leading-relaxed">
              <span className="font-semibold text-gray-800">Based on: </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {item.evidence.map((ev, i) => (
                  <span key={i} className="inline-flex rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs text-slate-600">{ev}</span>
                ))}
              </div>
            </div>
          </div>
        )}
        {(item.responsibleRole || item.timeframe || item.expectedOutcome) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-200/70 pt-2.5">
            {item.responsibleRole && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <UserRound className="size-3.5 text-slate-400" />
                <span className="font-semibold">Owner:</span> {item.responsibleRole}
              </span>
            )}
            {item.timeframe && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <Clock className="size-3.5 text-slate-400" />
                <span className="font-semibold">Timeframe:</span> {item.timeframe}
              </span>
            )}
            {item.expectedOutcome && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                <CheckCircle2 className="size-3.5 text-slate-400" />
                <span className="font-semibold">Expected outcome:</span> {item.expectedOutcome}
              </span>
            )}
          </div>
        )}
      </div>
      {footer}
    </div>
  );
}

// ── Recommendation feedback controls ────────────────────────────

const FEEDBACK_OPTIONS: { status: RecommendationFeedbackStatus; label: string }[] = [
  { status: "acknowledged", label: "Acknowledged" },
  { status: "applied", label: "Applied" },
  { status: "resolved", label: "Resolved" },
  { status: "dismissed", label: "Dismissed" },
];

const FEEDBACK_ACTIVE_STYLES: Record<RecommendationFeedbackStatus, string> = {
  acknowledged: "bg-sky-100 text-sky-700 ring-1 ring-sky-300",
  applied: "bg-violet-100 text-violet-700 ring-1 ring-violet-300",
  resolved: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
  dismissed: "bg-slate-200 text-slate-600 ring-1 ring-slate-300",
};

function RecommendationFeedbackControls({
  item,
  current,
  onSave,
  isSaving,
}: {
  item: InsightItem;
  current?: RecommendationFeedback;
  onSave: (item: InsightItem, status: RecommendationFeedbackStatus, note: string) => void;
  isSaving: boolean;
}) {
  // Seed from the saved feedback. The caller keys this component by the
  // feedback's updatedAt so a refetch remounts with the persisted note.
  const [note, setNote] = useState(current?.note ?? "");

  return (
    <div className="mt-4 border-t border-slate-200/70 pt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <MessageSquareText className="size-3.5 text-slate-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mr-1">
          Follow-up
        </span>
        {FEEDBACK_OPTIONS.map((opt) => {
          const active = current?.status === opt.status;
          return (
            <button
              key={opt.status}
              type="button"
              disabled={isSaving}
              onClick={() => onSave(item, opt.status, note)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 ${
                active
                  ? FEEDBACK_ACTIVE_STYLES[opt.status]
                  : "text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (e.g. why dismissed or how it was resolved)"
          className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 text-xs"
          disabled={isSaving}
          onClick={() => onSave(item, current?.status ?? "acknowledged", note)}
        >
          Save note
        </Button>
      </div>
    </div>
  );
}

// ── Outcome calibration panel ───────────────────────────────────

const OUTCOME_STYLES: Record<MetricOutcome, { label: string; className: string; icon: React.ElementType }> = {
  resolved: { label: "Resolved", className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  improved: { label: "Improved", className: "bg-sky-50 text-sky-700 border-sky-200", icon: TrendingUp },
  unchanged: { label: "Unchanged", className: "bg-slate-50 text-slate-600 border-slate-200", icon: Minus },
  worsened: { label: "Worsened", className: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertTriangle },
  unknown: { label: "No data", className: "bg-slate-50 text-slate-500 border-slate-200", icon: Info },
};

const OUTCOME_COLORS: Record<MetricOutcome, string> = {
  resolved: "#10b981",
  improved: "#0ea5e9",
  unchanged: "#94a3b8",
  worsened: "#f43f5e",
  unknown: "#cbd5e1",
};

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatMetricValue(value: number | null): string {
  if (value === null) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function OutcomeCalibrationPanel({
  data,
  isLoading,
  isError,
}: {
  data?: CalibrationResult;
  isLoading: boolean;
  isError: boolean;
}) {
  const outcomeOrder: MetricOutcome[] = ["resolved", "improved", "unchanged", "worsened", "unknown"];
  const outcomeData = data
    ? outcomeOrder
        .map((key) => ({ key, name: OUTCOME_STYLES[key].label, value: data.summary[key] ?? 0, color: OUTCOME_COLORS[key] }))
        .filter((row) => row.value > 0)
    : [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
          <Gauge className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Outcome Tracking</h2>
          <p className="text-sm text-gray-500">
            The saved analysis compared with today&apos;s live numbers — did the recommended
            indicators actually move?
          </p>
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
            <AlertTriangle className="size-4 text-amber-500" />
            Could not compute outcomes right now.
          </div>
        ) : !data || data.rows.length === 0 ? (
          <div className="text-sm text-gray-400 py-6 text-center">
            No trackable indicators were captured in this analysis.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              {outcomeData.length > 0 ? (
                <div className="h-40" role="img" aria-label="Donut chart of indicator outcomes">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <PieChart>
                      <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value" nameKey="name">
                        {outcomeData.map((row) => (
                          <Cell key={row.key} fill={row.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : null}
              <ul className="mt-2 space-y-1">
                {outcomeData.map((row) => (
                  <li key={row.key} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                    <span className="flex-1">{row.name}</span>
                    <span className="font-semibold tabular-nums text-gray-900">{row.value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-2 divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden">
              {data.rows.map((row) => {
                const s = OUTCOME_STYLES[row.outcome];
                const deltaText =
                  row.delta === null || row.delta === 0
                    ? "—"
                    : `${row.delta > 0 ? "+" : ""}${formatMetricValue(row.delta)}`;
                return (
                  <div key={row.key} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="text-sm text-gray-700">{row.label}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-gray-500 tabular-nums">
                        {formatMetricValue(row.baseline)}
                        <span className="mx-1 text-gray-300">→</span>
                        <span className="font-semibold text-gray-900">{formatMetricValue(row.current)}</span>
                      </span>
                      <span className="text-xs tabular-nums text-gray-400 w-12 text-right">{deltaText}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold w-24 justify-center ${s.className}`}>
                        <s.icon className="size-3" />
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function highestPriority(items: { severity: string }[]): string | null {
  if (items.some((i) => i.severity === "warning")) return PRIORITY_LABEL.warning;
  if (items.some((i) => i.severity === "info")) return PRIORITY_LABEL.info;
  if (items.length > 0) return PRIORITY_LABEL.positive;
  return null;
}

function StatChip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

/** Shared body rendered for any saved analysis (latest page + history view).
 *  This only DISPLAYS a saved record — it never calls the generation API. */
function AnalysisBody({
  record,
  feedbackByRec,
  onFeedback,
  savingFeedback,
  section,
}: {
  record: DecisionSupportAnalysis;
  feedbackByRec?: Record<string, RecommendationFeedback>;
  onFeedback?: (item: InsightItem, status: RecommendationFeedbackStatus, note: string) => void;
  savingFeedback?: boolean;
  section?: "data" | "recommendations" | "insights";
}) {
  const snapshot = record.dataSnapshot || ({} as DecisionSupportAnalysis["dataSnapshot"]);
  const overview = snapshot.overview;

  // Counts and rates are rendered as charts (SnapshotCharts). The values that
  // do not chart well — percentages, elapsed days — stay as a KPI strip.
  const kpis: { label: string; value: React.ReactNode }[] = [];
  if (overview) {
    if (isNumber(overview.totalRequests)) kpis.push({ label: "Document requests", value: overview.totalRequests });
    if (isNumber(overview.completionRate)) kpis.push({ label: "Completion rate", value: `${overview.completionRate}%` });
    if (isNumber(overview.weekOverWeekChange)) kpis.push({ label: "Requests vs last week", value: `${overview.weekOverWeekChange > 0 ? "+" : ""}${overview.weekOverWeekChange}%` });
    if (isNumber(overview.oldestPendingAgeDays)) kpis.push({ label: "Oldest pending (days)", value: overview.oldestPendingAgeDays });
    if (overview.processingTimeAvailable && isNumber(overview.averageProcessingTimeDays)) kpis.push({ label: "Avg processing (days)", value: overview.averageProcessingTimeDays });
    if (isNumber(overview.totalUsers)) kpis.push({ label: "Registered accounts", value: overview.totalUsers });
  }

  return (
    <>
      {/* ── Meta: when / who / what data ── */}
      {(!section || section === "data") && (
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 text-gray-400" />
            <span className="text-gray-400">Last generated:</span>
            <span className="font-semibold text-gray-900">{formatDateTime(record.generatedAt)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="size-4 text-gray-400" />
            <span className="text-gray-400">Generated by:</span>
            <span className="font-semibold text-gray-900">{record.generatedBy || "—"}</span>
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Data analyzed</p>
          <SnapshotCharts snapshot={snapshot} />
          {kpis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-4">
              {kpis.map((k) => (
                <StatChip key={k.label} label={k.label} value={k.value} />
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Recommendations ── */}
      {(!section || section === "recommendations") && (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
            <Target className="size-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recommended Actions</h2>
            <p className="text-sm text-gray-500">What the secretary can do about it</p>
          </div>
        </div>
        <div className="p-4">
          {record.recommendations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-10">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-base font-medium">No actions needed right now</p>
              <p className="text-sm">Recommendations will appear when an indicator crosses its threshold.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {record.recommendations.map((item) => (
                <InsightCard
                  key={item.id}
                  item={item}
                  footer={
                    onFeedback ? (
                      <RecommendationFeedbackControls
                        key={feedbackByRec?.[item.id]?.updatedAt ?? "unset"}
                        item={item}
                        current={feedbackByRec?.[item.id]}
                        onSave={onFeedback}
                        isSaving={!!savingFeedback}
                      />
                    ) : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Insights ── */}
      {(!section || section === "insights") && (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
            <Lightbulb className="size-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Insights</h2>
            <p className="text-sm text-gray-500">What is happening across the barangay right now</p>
          </div>
        </div>
        <div className="p-4">
          {record.insights.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-10">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-base font-medium">Everything looks healthy — no insights triggered</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {record.insights.map((item) => (
                <InsightCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </>
  );
}

/** Live-vs-snapshot resident count check for the latest saved analysis.
 *  Compares the current non-archived Resident Census total against the value
 *  frozen in the saved snapshot and warns when they diverge. */
function ResidentCountNotice({
  snapshotTotal,
  liveTotal,
  isLoading,
  isError,
  generatedAt,
  onRegenerate,
  isRegenerating,
}: {
  snapshotTotal?: number;
  liveTotal?: number;
  isLoading: boolean;
  isError: boolean;
  generatedAt?: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-gray-600">
        <Loader2 className="size-4 animate-spin text-gray-400" />
        Checking the current resident count...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
        <AlertTriangle className="size-5 shrink-0 mt-0.5 text-rose-600" />
        <div>
          <p className="text-base font-semibold text-rose-800">
            Could not check the resident count
          </p>
          <p className="text-sm text-rose-700 mt-0.5">
            The resident census could not be loaded right now. The saved analysis below is
            unchanged.
          </p>
        </div>
      </div>
    );
  }

  const status = residentCountStatus(liveTotal, snapshotTotal);

  if (status === "match") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="size-5 shrink-0 mt-0.5 text-emerald-600" />
        <div>
          <p className="text-base font-semibold text-emerald-800">
            {RESIDENT_COUNT_MATCH_MESSAGE}
          </p>
          <p className="text-sm text-emerald-700 mt-0.5">
            The saved snapshot matches the current census ({liveTotal}{" "}
            {liveTotal === 1 ? "resident" : "residents"}). Generated{" "}
            {formatDateTime(generatedAt)}.
          </p>
        </div>
      </div>
    );
  }

  if (status === "mismatch") {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <AlertTriangle className="size-5 shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="text-base text-amber-800">{RESIDENT_COUNT_MISMATCH_MESSAGE}</p>
          <p className="text-sm text-amber-700 mt-1">
            Analysis snapshot: {snapshotTotal} · Current census: {liveTotal} · Generated{" "}
            {formatDateTime(generatedAt)}
          </p>
        </div>
        <Button
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="gap-1.5 shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
        >
          {isRegenerating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {isRegenerating ? "Regenerating..." : "Regenerate"}
        </Button>
      </div>
    );
  }

  return null;
}

export function AnalyticsDecisionSupport({
  fromStr,
  rangeLabel,
}: {
  fromStr: string | null;
  rangeLabel: string;
}) {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [section, setSection] = useState<DSSection>("recommendations");

  // The date range applied to the next generation, shared with the Analytics
  // page's date-range filter. Sent as `{ from }` (YYYY-MM-DD); empty = all time.
  const currentRange = useMemo<{ from?: string }>(
    () => (fromStr ? { from: fromStr } : {}),
    [fromStr]
  );

  // Loads the latest SAVED analysis. Never generates anything.
  const latestQuery = useQuery<DecisionSupportAnalysis>({
    queryKey: ["decision-support", "latest"],
    queryFn: async () => {
      const res = await axiosInstance.get("/decision-support/latest");
      return res.data;
    },
    retry: false,
  });

  const isEmptyLatest =
    latestQuery.isError &&
    (latestQuery.error as AxiosError)?.response?.status === 404;

  // Live non-archived resident count from the SAME endpoint the Resident
  // Census page uses (no params = non-archived). Used only to detect that the
  // saved snapshot is stale — it never mutates or recounts resident data.
  const residentsQuery = useQuery<unknown[]>({
    queryKey: ["resident-census", false],
    queryFn: async () => {
      const res = await axiosInstance.get("/resident-census");
      return res.data as unknown[];
    },
    enabled: !!latestQuery.data,
    retry: false,
  });

  const generateMutation = useMutation({
    mutationFn: async (payload: { from?: string }) => {
      const res = await axiosInstance.post("/decision-support/generate", payload);
      return res.data as DecisionSupportAnalysis;
    },
    onSuccess: (analysis) => {
      successAlert("Decision Support analysis generated successfully.");
      queryClient.setQueryData(["decision-support", "latest"], analysis);
      queryClient.invalidateQueries({ queryKey: ["decision-support", "history"] });
      // Refresh the live census count so the snapshot check re-evaluates too.
      queryClient.invalidateQueries({ queryKey: ["resident-census"] });
    },
    onError: () => {
      errorAlert("Failed to generate the analysis. Your previous analysis was kept unchanged.");
    },
  });

  // History list — opened only via the "View History" button. Read-only.
  const historyQuery = useQuery<DecisionSupportAnalysis[]>({
    queryKey: ["decision-support", "history"],
    queryFn: async () => {
      const res = await axiosInstance.get("/decision-support/history");
      return res.data;
    },
    enabled: historyOpen,
  });

  // Selected history record — fetched by id, displayed without generating.
  const detailQuery = useQuery<DecisionSupportAnalysis>({
    queryKey: ["decision-support", "detail", viewingId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/decision-support/${viewingId}`);
      return res.data;
    },
    enabled: !!viewingId,
  });

  const record = latestQuery.data;
  const isMock = record?.provider === "rule-based" || record?.connected === false;

  const snapshotResidentTotal = record?.dataSnapshot?.community?.totalResidents;
  const liveResidentTotal = residentsQuery.data?.length;

  // Staff follow-up on the latest analysis' recommendations.
  const feedbackQuery = useQuery<RecommendationFeedback[]>({
    queryKey: ["decision-support", "feedback", record?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/decision-support/${record!._id}/feedback`);
      return res.data as RecommendationFeedback[];
    },
    enabled: !!record?._id,
  });

  const feedbackByRec = useMemo(() => {
    const map: Record<string, RecommendationFeedback> = {};
    for (const row of feedbackQuery.data ?? []) map[row.recommendationId] = row;
    return map;
  }, [feedbackQuery.data]);

  const feedbackMutation = useMutation({
    mutationFn: async (payload: {
      recommendationId: string;
      status: RecommendationFeedbackStatus;
      note: string;
      category?: string;
      title?: string;
    }) => {
      const res = await axiosInstance.put(`/decision-support/${record!._id}/feedback`, payload);
      return res.data as RecommendationFeedback;
    },
    onSuccess: () => {
      successAlert("Feedback saved.");
      queryClient.invalidateQueries({ queryKey: ["decision-support", "feedback", record?._id] });
    },
    onError: () => errorAlert("Failed to save feedback."),
  });

  const handleFeedback = (item: InsightItem, status: RecommendationFeedbackStatus, note: string) => {
    feedbackMutation.mutate({
      recommendationId: item.id,
      status,
      note,
      category: item.category,
      title: item.title,
    });
  };

  // Outcome calibration — how the saved snapshot's indicators compare to now.
  const calibrationQuery = useQuery<CalibrationResult>({
    queryKey: ["decision-support", "calibration", record?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/decision-support/${record!._id}/calibration`);
      return res.data as CalibrationResult;
    },
    enabled: !!record?._id,
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm">
            <Brain className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-gray-900">Decision Support</h2>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-sky-500" />
              Saved AI-generated recommendations based on barangay analytics.
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {record?.dataSnapshot?.period?.label
                ? `Data period: ${record.dataSnapshot.period.label}`
                : "Generate an analysis to see insights and recommendations."}
            </p>
          </div>
        </div>

        {/* ── Provider badge ── */}
        {record ? (
          <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200/80 shadow-sm px-3.5 py-2">
            {isMock ? (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
                <Sparkles className="size-3.5" />
                Powered by rule-based logic — AI provider not yet connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
                <CheckCircle2 className="size-3.5" />
                Live AI · {record.providerLabel}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Action buttons + analysis window ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => generateMutation.mutate(currentRange)}
          disabled={generateMutation.isPending}
          className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-lg shadow-sky-200/50 gap-1.5"
        >
          {generateMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          {generateMutation.isPending ? "Generating..." : "Generate New Analysis"}
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => setHistoryOpen(true)}>
          <History className="size-4" />
          View History
        </Button>
        <span className="text-xs text-slate-500 ml-1">
          Analysis window: <span className="font-semibold text-slate-700">{rangeLabel}</span>
        </span>
      </div>

      {/* ── Generation in progress — previous saved analysis stays visible ── */}
      {generateMutation.isPending && (
        <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <Loader2 className="size-4 animate-spin" />
          Analyzing community data...
        </div>
      )}

      {latestQuery.isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : isEmptyLatest ? (
        /* ── Empty state: no saved analysis yet ── */
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <div className="size-14 rounded-2xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
            <Brain className="size-7" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-800">
              No Decision Support analysis has been generated yet.
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Click “Generate New Analysis” to create insights and recommendations from the latest barangay data.
            </p>
          </div>
          <Button
            onClick={() => generateMutation.mutate(currentRange)}
            disabled={generateMutation.isPending}
            className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-lg shadow-sky-200/50 gap-1.5"
          >
            {generateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {generateMutation.isPending ? "Generating..." : "Generate New Analysis"}
          </Button>
        </div>
      ) : latestQuery.isError ? (
        <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-10">
          <AlertTriangle className="size-8 text-amber-500" />
          <p className="text-sm font-medium">Could not load the saved analysis</p>
          <p className="text-xs">Check that the backend analytics service is running.</p>
        </div>
      ) : record ? (
        <>
          {/* ── Section switcher: one panel at a time, no long scrolling ── */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm">
            {(
              [
                { key: "data", label: "Data", icon: BarChart3 },
                { key: "recommendations", label: "Recommendations", icon: Target, count: record.recommendations.length },
                { key: "insights", label: "Insights", icon: Lightbulb, count: record.insights.length },
                { key: "outcomes", label: "Outcomes", icon: Gauge, count: calibrationQuery.data?.rows.length },
                { key: "benefits", label: "Benefits", icon: Wallet },
              ] as { key: DSSection; label: string; icon: React.ElementType; count?: number }[]
            ).map((s) => {
              const active = section === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-gradient-to-r from-sky-50 to-emerald-50 text-sky-700 shadow-sm ring-1 ring-sky-100"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                >
                  <s.icon className="size-4" />
                  {s.label}
                  {typeof s.count === "number" && s.count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                      {s.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {section === "data" && (
            <>
              <ResidentCountNotice
                snapshotTotal={snapshotResidentTotal}
                liveTotal={liveResidentTotal}
                isLoading={residentsQuery.isLoading}
                isError={residentsQuery.isError}
                generatedAt={record.generatedAt}
                onRegenerate={() => generateMutation.mutate(currentRange)}
                isRegenerating={generateMutation.isPending}
              />
              <AnalysisBody
                record={record}
                section="data"
                feedbackByRec={feedbackByRec}
                onFeedback={handleFeedback}
                savingFeedback={feedbackMutation.isPending}
              />
            </>
          )}

          {section === "recommendations" && (
            <AnalysisBody
              record={record}
              section="recommendations"
              feedbackByRec={feedbackByRec}
              onFeedback={handleFeedback}
              savingFeedback={feedbackMutation.isPending}
            />
          )}

          {section === "insights" && (
            <AnalysisBody
              record={record}
              section="insights"
              feedbackByRec={feedbackByRec}
              onFeedback={handleFeedback}
              savingFeedback={feedbackMutation.isPending}
            />
          )}

          {section === "outcomes" && (
            <OutcomeCalibrationPanel
              data={calibrationQuery.data}
              isLoading={calibrationQuery.isLoading}
              isError={calibrationQuery.isError}
            />
          )}

          {section === "benefits" && <ProgramEligibilityPanel />}
        </>
      ) : null}

      {/* Benefits remain available even before an analysis exists. */}
      {!record && !latestQuery.isLoading && <ProgramEligibilityPanel />}

      {/* ── History dialog ── */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Decision Support History</DialogTitle>
            <DialogDescription>
              Previously generated analyses. Viewing history never generates a new analysis.
            </DialogDescription>
          </DialogHeader>
          {historyQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : historyQuery.isError ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
              <Clock className="size-4" />
              Could not load history.
            </div>
          ) : historyQuery.data?.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-8">
              <History className="size-8 text-slate-300" />
              <p className="text-sm font-medium">No previous analyses found</p>
              <p className="text-xs">Generate one first, then it will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyQuery.data?.map((item) => {
                const priority = highestPriority(item.recommendations);
                return (
                  <div key={item._id} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-gray-900 truncate">{item.summary}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-4 text-gray-400" />
                          {formatDateTime(item.generatedAt)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-4 text-gray-400" />
                          {item.generatedBy || "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Target className="size-4 text-gray-400" />
                          {item.recommendations.length} recommendation{item.recommendations.length === 1 ? "" : "s"}
                        </span>
                        {priority && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-0.5 text-xs font-semibold">
                            Highest: {priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 shrink-0"
                      onClick={() => setViewingId(item._id)}
                    >
                      <Eye className="size-3.5" />
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Saved analysis detail (from history) ── */}
      <Dialog open={!!viewingId} onOpenChange={(open) => { if (!open) setViewingId(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Saved Analysis</DialogTitle>
            <DialogDescription>
              {detailQuery.data ? formatDateTime(detailQuery.data.generatedAt) : "Loading..."}
            </DialogDescription>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </div>
          ) : detailQuery.isError ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
              <AlertTriangle className="size-4 text-amber-500" />
              Could not load this analysis.
            </div>
          ) : detailQuery.data ? (
            <AnalysisBody record={detailQuery.data} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
