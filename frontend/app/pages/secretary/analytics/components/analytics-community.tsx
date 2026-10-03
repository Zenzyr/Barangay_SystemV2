"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunitySectorCharts } from "./analytics-community-sectors";
import {
  BarChart,
  Bar,
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
  Users,
  Home,
  Baby,
  Briefcase,
  UserRound,
  Accessibility,
  Sparkles,
  GraduationCap,
  MapPin,
  FileText,
  Clock,
  Info,
} from "lucide-react";

const CHART_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#14b8a6"];

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

function useAnalytics(path: string) {
  return useQuery({
    queryKey: ["community-analytics", path],
    queryFn: async () => (await axiosInstance.get(`/analytics/${path}`)).data,
  });
}

export function AnalyticsCommunity({ rangeLabel = "All time" }: { rangeLabel?: string }) {
  const overview = useAnalytics("overview");
  const employment = useAnalytics("employment");
  const education = useAnalytics("education");
  const seniors = useAnalytics("seniors");
  const pwd = useAnalytics("pwd");
  const youth = useAnalytics("youth");
  const social = useAnalytics("social-welfare");
  const health = useAnalytics("health");
  const disaster = useAnalytics("disaster");
  const environment = useAnalytics("environment");
  const peaceAndOrder = useAnalytics("peace-and-order");
  const purok = useAnalytics("purok");
  const signals = useAnalytics("service-request-signals");
  const trends = useAnalytics("trends");

  const ov = overview.data;

  const OVERVIEW_CARDS = [
    { label: "Total Residents", value: ov?.totalResidents, icon: Users, bg: "bg-sky-50", text: "text-sky-700", iconBg: "bg-sky-100", iconColor: "text-sky-600" },
    { label: "Households", value: ov?.totalHouseholds, icon: Home, bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
    { label: "Children (<15)", value: ov?.children, icon: Baby, bg: "bg-pink-50", text: "text-pink-700", iconBg: "bg-pink-100", iconColor: "text-pink-600" },
    { label: "Youth (15-30)", value: ov?.youth, icon: Sparkles, bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    { label: "Working-Age", value: ov?.workingAgePopulation, icon: Briefcase, bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
    { label: "Senior Citizens", value: ov?.seniorCitizens, icon: UserRound, bg: "bg-teal-50", text: "text-teal-700", iconBg: "bg-teal-100", iconColor: "text-teal-600" },
    { label: "PWD", value: ov?.pwd, icon: Accessibility, bg: "bg-fuchsia-50", text: "text-fuchsia-700", iconBg: "bg-fuchsia-100", iconColor: "text-fuchsia-600" },
  ];

  return (
    <div className="w-full space-y-6">
      {/* ── Population Overview ── */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Population Overview</h2>
          {rangeLabel !== "All time" && (
            <span className="text-xs font-medium text-gray-400">Census is a snapshot — shown for: {rangeLabel}</span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {OVERVIEW_CARDS.map((s) => (
            <div key={s.label} className={`rounded-2xl border border-slate-200/80 p-3.5 shadow-sm ${s.bg}`}>
              <div className={`size-7 rounded-lg flex items-center justify-center mb-2 ${s.iconBg}`}>
                <s.icon className={`size-3.5 ${s.iconColor}`} />
              </div>
              {overview.isLoading ? <Skeleton className="h-6 w-8" /> : <p className={`text-xl font-bold ${s.text}`}>{s.value ?? "—"}</p>}
              <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <CommunitySectorCharts
        queries={{ employment, education, seniors, pwd, youth, social, health, disaster, environment, peaceAndOrder }}
      />

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Purok Comparison */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 lg:col-span-2 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <MapPin className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Purok Comparison — Unemployment vs Out-of-School (Heuristic)</h3>
          </div>
          {purok.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : purok.data && purok.data.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={purok.data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="purok" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="unemploymentRateHeuristic" name="Unemployment %" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outOfSchoolRateHeuristic" name="Out-of-School %" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <MapPin className="size-5" />
              </div>
              <p className="text-sm">No purok data available</p>
            </div>
          )}
        </div>

        {/* Education Attainment */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <GraduationCap className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Educational Attainment</h3>
          </div>
          {education.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : education.data?.attainmentDistribution?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={education.data.attainmentDistribution.slice(0, 6)}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}
                    dataKey="count" nameKey="name"
                  >
                    {education.data.attainmentDistribution.slice(0, 6).map((_: Record<string, unknown>, index: number) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="bottom" height={50} formatter={(v: string) => <span className="text-[11px] text-gray-600">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <GraduationCap className="size-5" />
              </div>
              <p className="text-sm">No education data available</p>
            </div>
          )}
        </div>

        {/* Top Occupations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
              <Briefcase className="size-4" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Most Common Occupations</h3>
          </div>
          {employment.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : employment.data?.topOccupations?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <BarChart data={employment.data.topOccupations} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Residents" radius={[0, 4, 4, 0]}>
                    {employment.data.topOccupations.map((_: Record<string, unknown>, index: number) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center gap-2 text-center text-gray-400">
              <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                <Briefcase className="size-5" />
              </div>
              <p className="text-sm">No occupation data available</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Historical Trends ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
            <Clock className="size-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Historical Trends</h3>
        </div>
        {trends.isLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-start gap-2 text-gray-500 bg-gray-50 rounded-xl p-3 text-sm">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span>{trends.data?.message}</span>
          </div>
        )}
      </div>

      {/* ── Service Request Signals ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 mb-3">
          <div className="size-8 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
            <FileText className="size-4" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Service Request Signals</h3>
        </div>
        {signals.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-gray-50 border border-slate-100 p-3">
                <p className="text-lg font-bold text-gray-900">{signals.data?.totalRegisteredResidents}</p>
                <p className="text-xs text-gray-500">Registered Login Residents</p>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-3">
                <p className="text-lg font-bold text-rose-700">{signals.data?.indigencyRequests}</p>
                <p className="text-xs text-gray-500">Indigency Certificate Requests ({signals.data?.indigencyRequestRate}%)</p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3 italic">{signals.data?.note}</p>
          </>
        )}
      </div>
    </div>
  );
}