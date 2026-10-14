"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DecisionSupportAnalysis, InsightItem } from "@/app/types/ai.type";
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
} from "lucide-react";

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

function InsightCard({ item }: { item: InsightItem }) {
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
function AnalysisBody({ record }: { record: DecisionSupportAnalysis }) {
  const snapshot = record.dataSnapshot || ({} as DecisionSupportAnalysis["dataSnapshot"]);
  const overview = snapshot.overview;
  const community = snapshot.community;
  const rates = community?.sectorRates || {};
  const rateChips: [string, number | undefined][] = [
    ["Unemployment (heuristic)", rates.unemploymentRateHeuristic],
    ["Out-of-school (heuristic)", rates.outOfSchoolRateHeuristic],
    ["Senior citizens", rates.seniorCitizenRate],
    ["PWD", rates.pwdRate],
    ["Youth", rates.youthRate],
    ["4Ps", rates.fourPsRate],
    ["Solo parents", rates.soloParentRate],
    ["HPN maintenance", rates.hpnMaintenanceRate],
  ].filter(([, v]) => typeof v === "number") as [string, number][];

  return (
    <>
      {/* ── Meta: when / who / what data ── */}
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
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Data analyzed</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <StatChip label="Total Residents" value={community?.totalResidents ?? "—"} />
            <StatChip label="Households" value={community?.totalHouseholds ?? "—"} />
            <StatChip label="Children (<15)" value={community?.children ?? "—"} />
            <StatChip label="Youth (15-30)" value={community?.youth ?? "—"} />
            <StatChip label="Document Requests" value={overview?.totalRequests ?? "—"} />
            <StatChip label="Completion Rate" value={overview?.completionRate != null ? `${overview.completionRate}%` : "—"} />
          </div>
        </div>

        {/* ── Operational metrics (only what the schema actually supports) ── */}
        {overview && (typeof overview.backlogCount === "number" || typeof overview.counterPaymentCount === "number") && (
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Operations</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <StatChip label="Backlog (>3 days)" value={overview.backlogCount ?? "—"} />
              <StatChip label="Oldest pending (days)" value={overview.oldestPendingAgeDays != null ? overview.oldestPendingAgeDays : "—"} />
              <StatChip label="Avg processing (days)" value={overview.processingTimeAvailable && overview.averageProcessingTimeDays != null ? overview.averageProcessingTimeDays : "n/a"} />
              <StatChip label="Unpaid fees" value={overview.unpaidCount ?? "—"} />
              <StatChip label="Counter-payments" value={overview.counterPaymentCount ?? "—"} />
              <StatChip label="Payment verify queue" value={overview.pendingVerificationCount ?? "—"} />
              <StatChip label="Blocked from release" value={overview.blockedFromRelease ?? "—"} />
              <StatChip label="ID verification queue" value={overview.pendingUsers ?? "—"} />
              {overview.weekOverWeekChange != null && (
                <StatChip label="Requests vs last week" value={overview.weekOverWeekChange > 0 ? `+${overview.weekOverWeekChange}%` : `${overview.weekOverWeekChange}%`} />
              )}
            </div>
          </div>
        )}

        {/* ── Sector rates ── */}
        {rateChips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {rateChips.map(([label, value]) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-3 py-1 text-sm text-gray-600">
                  <span className="text-gray-400">{label}:</span>
                  <span className="font-semibold text-gray-800">{value}%</span>
                </span>
              ))}
            </div>
          )}
        </div>

      {/* ── Recommendations ── */}
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
                <InsightCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Insights ── */}
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

export default function DecisionSupportPage() {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

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
    mutationFn: async () => {
      const res = await axiosInstance.post("/decision-support/generate");
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

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <BackButton />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm">
            <Brain className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Decision Support
            </h1>
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
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200/80 shadow-sm px-3.5 py-2">
          {record ? (
            isMock ? (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
                <Sparkles className="size-3.5" />
                Powered by rule-based logic — AI provider not yet connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
                <CheckCircle2 className="size-3.5" />
                Live AI · {record.providerLabel}
              </span>
            )
          ) : null}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => generateMutation.mutate()}
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
            onClick={() => generateMutation.mutate()}
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
          <ResidentCountNotice
            snapshotTotal={snapshotResidentTotal}
            liveTotal={liveResidentTotal}
            isLoading={residentsQuery.isLoading}
            isError={residentsQuery.isError}
            generatedAt={record.generatedAt}
            onRegenerate={() => generateMutation.mutate()}
            isRegenerating={generateMutation.isPending}
          />

          <AnalysisBody record={record} />
        </>
      ) : null}

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