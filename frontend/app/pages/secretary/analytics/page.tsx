"use client";

import { useMemo, useState } from "react";
import { BarChart3, Sparkles, CalendarRange } from "lucide-react";
import { AnalyticsOverview } from "./components/analytics-overview";
import { AnalyticsCommunity } from "./components/analytics-community";

type TabKey = "overview" | "community";
type RangeKey = "all" | "7d" | "14d" | "30d";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "30d", label: "Last 30 days" },
  { key: "14d", label: "Last 14 days" },
  { key: "7d", label: "Last 7 days" },
];

const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = { "7d": 7, "14d": 14, "30d": 30 };

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "community", label: "Community", icon: Sparkles },
];

export default function SecretaryAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [range, setRange] = useState<RangeKey>("all");

  const from = useMemo<Date | null>(() => {
    if (range === "all") return null;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - RANGE_DAYS[range]);
    return d;
  }, [range]);

  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === range)?.label || "All time";

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
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

        {/* ── Shared date-range filter (respected by both tabs) ── */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200/80 shadow-sm px-3 py-2">
          <CalendarRange className="size-4 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">Date range</span>
          <div className="flex items-center gap-1">
            {RANGE_OPTIONS.map((opt) => (
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
        <AnalyticsOverview from={from} rangeLabel={rangeLabel} />
      ) : (
        <AnalyticsCommunity rangeLabel={rangeLabel} />
      )}
    </div>
  );
}