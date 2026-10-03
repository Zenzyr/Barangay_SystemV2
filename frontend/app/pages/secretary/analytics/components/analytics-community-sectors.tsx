"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Info, Scale, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DataError } from "@/components/ui/data-state-renderer";

const PREVALENCE_COLORS = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#14b8a6"];
const AFFECTED_COLOR = "#f59e0b";
const REMAINDER_COLOR = "#cbd5e1";

type SectorQuery = UseQueryResult<Record<string, unknown> | undefined>;

export interface SectorQueries {
  employment: SectorQuery;
  education: SectorQuery;
  seniors: SectorQuery;
  pwd: SectorQuery;
  youth: SectorQuery;
  social: SectorQuery;
  health: SectorQuery;
  disaster: SectorQuery;
  environment: SectorQuery;
  peaceAndOrder: SectorQuery;
}

const num = (value: unknown): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
};

const pct = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;

interface PrevalenceRow {
  sector: string;
  rate: number;
  count: number;
  base: number;
  detail?: string;
  label: string;
}

interface GapRow {
  indicator: string;
  affected: number;
  remainder: number;
  base: number;
  rate: number;
  affectedLabel: string;
  baseLabel: string;
}

interface TooltipPayload<T> {
  payload?: T;
}

function PrevalenceTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload<PrevalenceRow>[] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-gray-900">{row.sector}</p>
      <p className="text-gray-600">
        <span className="font-medium text-gray-900">{row.count.toLocaleString()}</span> of {row.base.toLocaleString()} residents ({pct(row.rate)})
      </p>
      {row.detail ? <p className="mt-0.5 text-xs text-gray-500">{row.detail}</p> : null}
    </div>
  );
}

function GapTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload<GapRow>[] }) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
  return (
    <div className="max-w-[16rem] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-semibold text-gray-900">{row.indicator}</p>
      <p className="text-gray-600">
        <span className="font-medium text-gray-900">{row.affected.toLocaleString()}</span> {row.affectedLabel} of {row.base.toLocaleString()} {row.baseLabel} ({pct(row.rate)})
      </p>
      <p className="mt-0.5 text-xs text-gray-500">Estimate based on census entries</p>
    </div>
  );
}

function ChartCard({
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
    <div className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${className ?? ""}`}>
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

export function CommunitySectorCharts({ queries }: { queries: SectorQueries }) {
  const { employment, education, seniors, pwd, youth, social, health, disaster, environment, peaceAndOrder } = queries;

  const dataQueries = [employment, education, seniors, pwd, youth, social, health];
  const loading = dataQueries.some((q) => q.isLoading);
  const failed = dataQueries.filter((q) => q.isError);
  const retry = () => failed.forEach((q) => q.refetch());

  const s = seniors.data ?? {};
  const p = pwd.data ?? {};
  const y = youth.data ?? {};
  const w = social.data ?? {};
  const h = health.data ?? {};
  const e = employment.data ?? {};
  const ed = education.data ?? {};

  const totalResidents = num(s.totalResidents ?? p.totalResidents ?? w.totalResidents);

  const prevalence: PrevalenceRow[] = [
    { sector: "Senior Citizens", rate: num(s.seniorCitizenRate), count: num(s.seniorCitizens), base: num(s.totalResidents), detail: `${num(s.pensioners).toLocaleString()} pensioners recorded` },
    { sector: "PWD", rate: num(p.pwdRate), count: num(p.pwd), base: num(p.totalResidents) },
    { sector: "Youth (15–30)", rate: num(y.youthRate), count: num(y.youthPopulation), base: num(y.totalResidents), detail: `${num(y.employedYouthHeuristic).toLocaleString()} with a recorded occupation (estimate)` },
    { sector: "4Ps Beneficiaries", rate: num(w.fourPsRate), count: num(w.fourPsBeneficiaries), base: num(w.totalResidents) },
    { sector: "Solo Parents", rate: num(w.soloParentRate), count: num(w.soloParents), base: num(w.totalResidents) },
    { sector: "HPN Maintenance", rate: num(h.hpnMaintenanceRate), count: num(h.hpnMaintenance), base: num(h.totalResidents), detail: "Hypertension/diabetes medication upkeep (partial health data)" },
  ]
    .map((row) => ({ ...row, label: `${pct(row.rate)} · ${row.count.toLocaleString()}` }))
    .sort((a, b) => b.rate - a.rate);

  const gaps: GapRow[] = [
    {
      indicator: "Unemployment",
      affected: num(e.unemployedHeuristic),
      base: num(e.workingAgePopulation),
      rate: num(e.unemploymentRateHeuristic),
      affectedLabel: "without a recorded occupation",
      baseLabel: "working-age (15–64)",
    },
    {
      indicator: "Out of school",
      affected: num(ed.outOfSchoolHeuristic),
      base: num(ed.schoolAgePopulation),
      rate: num(ed.outOfSchoolRateHeuristic),
      affectedLabel: "without a recorded education level",
      baseLabel: "school-age (5–17)",
    },
  ]
    .filter((row) => row.base > 0)
    .map((row) => ({ ...row, remainder: Math.max(row.base - row.affected, 0) }));

  const untracked = [
    { name: "Disaster Risk", data: disaster.data },
    { name: "Environment", data: environment.data },
    { name: "Peace & Order", data: peaceAndOrder.data },
  ].filter((sector) => sector.data && sector.data.available === false);

  const notes = [e.note, ed.note, h.note].filter((n): n is string => typeof n === "string" && n.length > 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700">Community Indicators by Sector</h2>
        {!loading && !failed.length && totalResidents > 0 ? (
          <span className="text-xs text-gray-400">Based on {totalResidents.toLocaleString()} census residents</span>
        ) : null}
      </div>

      {failed.length ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <DataError message="Some community sector data could not be loaded." refetch={retry} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          <ChartCard
            title="Sector Share of Residents"
            subtitle="Percentage of all census residents in each sector"
            icon={Users}
            className="xl:col-span-3"
          >
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : totalResidents === 0 ? (
              <EmptyChart message="No census residents recorded yet" />
            ) : (
              <>
                <div className="h-72" role="img" aria-label="Horizontal bar chart of the share of residents in each sector">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={prevalence} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, (max: number) => Math.max(10, Math.ceil(max / 10) * 10)]}
                        tickFormatter={(v: number) => `${v}%`}
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis type="category" dataKey="sector" width={128} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} interval={0} />
                      <Tooltip content={<PrevalenceTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="rate" name="Share of residents" radius={[0, 6, 6, 0]} minPointSize={2}>
                        {prevalence.map((row, index) => (
                          <Cell key={row.sector} fill={PREVALENCE_COLORS[index % PREVALENCE_COLORS.length]} />
                        ))}
                        <LabelList dataKey="label" position="right" style={{ fontSize: 11, fill: "#334155" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="sr-only">
                  {prevalence.map((row) => (
                    <li key={row.sector}>{`${row.sector}: ${row.count} of ${row.base} residents, ${pct(row.rate)}`}</li>
                  ))}
                </ul>
              </>
            )}
          </ChartCard>

          <ChartCard
            title="Estimated Gaps"
            subtitle="Share of each age group without a recorded occupation or education level"
            icon={Scale}
            className="xl:col-span-2"
          >
            {loading ? (
              <Skeleton className="h-72 w-full" />
            ) : gaps.length === 0 ? (
              <EmptyChart message="No working-age or school-age residents recorded yet" />
            ) : (
              <>
                <div className="h-56" role="img" aria-label="Stacked bar chart of estimated unemployment and out-of-school shares">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={gaps} layout="vertical" stackOffset="expand" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v * 100)}%`} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="indicator" width={96} tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<GapTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value: string) => <span className="text-gray-600">{value}</span>} />
                      <Bar dataKey="affected" name="Estimated gap" stackId="gap" fill={AFFECTED_COLOR} />
                      <Bar dataKey="remainder" name="Recorded" stackId="gap" fill={REMAINDER_COLOR} radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  {gaps.map((row) => (
                    <div key={row.indicator} className="rounded-xl bg-amber-50/70 px-3 py-2">
                      <dt className="text-xs text-gray-500">{row.indicator}</dt>
                      <dd className="text-lg font-bold tabular-nums text-amber-700">{pct(row.rate)}</dd>
                      <dd className="text-[11px] text-gray-500">
                        {row.affected.toLocaleString()} of {row.base.toLocaleString()} {row.baseLabel}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </ChartCard>
        </div>
      )}

      {untracked.length || notes.length ? (
        <div className="mt-3 flex flex-col gap-2 text-xs text-gray-500">
          {untracked.length ? (
            <p className="flex flex-wrap items-center gap-1.5">
              <Info className="size-3.5 shrink-0 text-gray-400" />
              <span>Not tracked yet (no data source in the current system):</span>
              {untracked.map((sector) => (
                <span
                  key={sector.name}
                  title={typeof sector.data?.message === "string" ? sector.data.message : undefined}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                >
                  {sector.name}
                </span>
              ))}
            </p>
          ) : null}
          {notes.length ? (
            <details className="group">
              <summary className="cursor-pointer select-none text-gray-500 hover:text-gray-700">About these figures</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-500">
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
