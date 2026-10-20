"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BarChart3, Sparkles, Brain, CalendarRange } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ANALYTICS_RANGE_OPTIONS,
  AnalyticsRangeKey,
  rangeLabelFor,
  rangeStartDate,
  toLocalDateString,
} from "@/app/utils/analyticsRange";

import { AnalyticsOverview } from "./components/analytics-overview";
import { AnalyticsCommunity } from "./components/analytics-community";
import { AnalyticsDecisionSupport } from "./components/analytics-decision-support";

type TabKey = "overview" | "community" | "decision-support";

const TAB_KEYS: TabKey[] = ["overview", "community", "decision-support"];

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "community", label: "Community", icon: Sparkles },
  { key: "decision-support", label: "Decision Support", icon: Brain },
];

function isTabKey(value: string | null): value is TabKey {
  return value != null && (TAB_KEYS as string[]).includes(value);
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<TabKey>(
    isTabKey(requestedTab) ? requestedTab : "overview"
  );
  const [range, setRange] = useState<AnalyticsRangeKey>("all");

  const from = useMemo<Date | null>(() => rangeStartDate(range), [range]);
  const fromStr = useMemo<string | null>(
    () => (from ? toLocalDateString(from) : null),
    [from]
  );

  const rangeLabel = rangeLabelFor(range);

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <BackButton />
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Analytics
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              General system analytics and community insights — all in one place
            </p>
          </div>
        </div>

        {/* ── Shared date-range filter (respected by all tabs) ── */}
        <div className="flex items-center gap-2 self-start lg:self-auto max-w-full bg-white rounded-xl border border-slate-200/80 shadow-sm px-3 py-2">
          <CalendarRange className="size-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">Date range</span>
          <div className="flex flex-wrap items-center gap-1">
            {ANALYTICS_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRange(opt.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  range === opt.key
                    ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-white border border-slate-200/80 shadow-sm p-1">
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                active
                  ? "bg-gradient-to-r from-sky-50 to-emerald-50 text-sky-700 shadow-sm ring-1 ring-sky-100"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" ? (
        <AnalyticsOverview from={from} />
      ) : activeTab === "community" ? (
        <AnalyticsCommunity rangeLabel={rangeLabel} />
      ) : (
        <AnalyticsDecisionSupport fromStr={fromStr} rangeLabel={rangeLabel} />
      )}
    </div>
  );
}

export default function SecretaryAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-[60vh] w-full rounded-2xl" />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
