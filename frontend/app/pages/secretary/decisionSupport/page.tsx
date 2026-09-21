"use client";
import { BackButton } from "@/components/ui/BackButton";


import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalyticsInsightsResponse, InsightItem } from "@/app/types/ai.type";
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
} from "lucide-react";

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; iconBg: string; iconColor: string; label: string }> = {
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", iconBg: "bg-amber-100", iconColor: "text-amber-600", label: "Needs attention" },
  info: { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-900", iconBg: "bg-sky-100", iconColor: "text-sky-600", label: "Watch" },
  positive: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", label: "Good sign" },
};

function InsightCard({ item }: { item: InsightItem }) {
  const style = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.info;
  const SeverityIcon = item.severity === "warning" ? AlertTriangle : item.severity === "positive" ? CheckCircle2 : Info;
  return (
    <div className={`rounded-xl border ${style.bg} ${style.border} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.iconBg} ${style.iconColor}`}>
            <SeverityIcon className="size-3" />
            {style.label}
          </span>
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{item.category}</span>
        </div>
      </div>
      <p className={`text-sm font-semibold ${style.text}`}>{item.title}</p>
      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-2">
          <ShieldAlert className={`size-4 shrink-0 mt-0.5 ${style.iconColor}`} />
          <p className="text-xs text-gray-700 leading-relaxed"><span className="font-semibold text-gray-800">Why: </span>{item.why}</p>
        </div>
        <div className="flex items-start gap-2">
          <Target className={`size-4 shrink-0 mt-0.5 text-sky-600`} />
          <p className="text-xs text-gray-700 leading-relaxed"><span className="font-semibold text-gray-800">Action: </span>{item.action}</p>
        </div>
      </div>
    </div>
  );
}

export default function DecisionSupportPage() {
  const { data, isLoading, isError } = useQuery<AnalyticsInsightsResponse>({
    queryKey: ["analytics", "insights"],
    queryFn: async () => {
      const res = await axiosInstance.get("/analytics/insights");
      return res.data;
    },
  });

  const isMock = data?.provider === "rule-based" || data?.connected === false;

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
              AI-generated recommendations based on current barangay analytics.
            </p>            <p className="text-sm text-gray-500 mt-0.5">
              AI-driven insights and recommendations based on current analytics
              {data?.period ? ` · ${data.period.label}` : ""}
            </p>
          </div>
        </div>

        {/* ── Provider badge ── */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200/80 shadow-sm px-3.5 py-2">
          {isMock ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
              <Sparkles className="size-3.5" />
              Powered by rule-based logic — AI provider not yet connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
              <CheckCircle2 className="size-3.5" />
              Live AI · {data?.providerLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── Provider notice ── */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Info className="size-4 shrink-0 mt-0.5 text-amber-600" />
        <p className="text-sm text-amber-800">
          {isMock
            ? "These suggestions are generated by simple threshold rules on the analytics data service (AI_PROVIDER=rule-based). Once a real AI provider is configured, this page will automatically show model-generated reasoning — no UI changes needed."
            : `Insights generated by ${data?.providerLabel} from the shared analytics data service.`}
        </p>
      </div>

      {/* ── Insights ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
            <Lightbulb className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Insights</h2>
            <p className="text-xs text-gray-500">What is happening across the barangay right now</p>
          </div>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-2xl" />
              ))}
            </div>
          ) : isError || !data ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-10">
              <AlertTriangle className="size-8 text-amber-500" />
              <p className="text-sm font-medium">Could not load insights</p>
              <p className="text-xs">Check that the backend analytics service is running.</p>
            </div>
          ) : data.insights.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-10">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-sm font-medium">Everything looks healthy — no insights triggered</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.insights.map((item) => (
                <InsightCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recommendations ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
            <Target className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Recommended Actions</h2>
            <p className="text-xs text-gray-500">What the secretary can do about it</p>
          </div>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-2xl" />
              ))}
            </div>
          ) : isError || !data ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-10">
              <Clock className="size-8 text-slate-300" />
              <p className="text-sm font-medium">No recommendations available</p>
            </div>
          ) : data.recommendations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-10">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-sm font-medium">No actions needed right now</p>
              <p className="text-xs">Recommendations will appear when an indicator crosses its threshold.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.recommendations.map((item) => (
                <InsightCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Confidence ── */}
      {data?.confidence != null && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Info className="size-3.5" />
          <span>Model confidence: {Math.round(data.confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
}