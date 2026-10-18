"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProgramEligibilityResult,
  ProgramEnrollment,
  HouseholdMember,
} from "@/app/types/programEligibility.type";
import { ChartCard, ChartTooltip } from "./decisionSupportCharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wallet,
  HardHat,
  Users,
  Home,
  BadgeCheck,
  AlertTriangle,
  Layers,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react";

function peso(value: number): string {
  return `₱${Number(value || 0).toLocaleString("en-PH")}`;
}

const INCOME_BUCKETS = [
  { label: "₱0–9,999", min: 0, max: 9999 },
  { label: "₱10k–19,999", min: 10000, max: 19999 },
  { label: "₱20k–29,999", min: 20000, max: 29999 },
  { label: "₱30k–49,999", min: 30000, max: 49999 },
  { label: "₱50k+", min: 50000, max: Infinity },
];

function MemberRow({
  member,
  enrolled,
  onEnroll,
  onRemove,
  busy,
}: {
  member: HouseholdMember;
  enrolled?: ProgramEnrollment;
  onEnroll: (member: HouseholdMember) => void;
  onRemove: (enrollment: ProgramEnrollment) => void;
  busy: boolean;
}) {
  const active = enrolled && enrolled.status === "enrolled";
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{member.name}</p>
        <p className="text-xs text-gray-400">
          {member.householdNumber} · {member.purok} · Household {peso(member.householdTotalIncome)}/mo
        </p>
      </div>
      {active ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(enrolled!)}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60 shrink-0"
          title="Remove beneficiary"
        >
          <BadgeCheck className="size-3.5" />
          Beneficiary
        </button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onEnroll(member)}
          className="h-8 shrink-0 text-xs gap-1"
        >
          Mark beneficiary
        </Button>
      )}
    </div>
  );
}

export function ProgramEligibilityPanel() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"4Ps" | "TUPAD">("4Ps");

  const eligibilityQuery = useQuery<ProgramEligibilityResult>({
    queryKey: ["program-eligibility"],
    queryFn: async () => (await axiosInstance.get("/program-eligibility")).data,
  });

  const enrollmentsQuery = useQuery<ProgramEnrollment[]>({
    queryKey: ["program-eligibility", "enrollments"],
    queryFn: async () => (await axiosInstance.get("/program-eligibility/enrollments")).data,
  });

  const enrolledByKey = useMemo(() => {
    const map: Record<string, ProgramEnrollment> = {};
    for (const row of enrollmentsQuery.data ?? []) {
      if (row.status === "enrolled") map[`${row.program}:${row.censusId}`] = row;
    }
    return map;
  }, [enrollmentsQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["program-eligibility", "enrollments"] });
    queryClient.invalidateQueries({ queryKey: ["resident-census"] });
  };

  const enrollMutation = useMutation({
    mutationFn: async ({ program, censusId }: { program: "4Ps" | "TUPAD"; censusId: string }) =>
      (await axiosInstance.post("/program-eligibility/enrollments", { program, censusId })).data,
    onSuccess: (_data, vars) => {
      successAlert(`Marked as ${vars.program} beneficiary.`);
      invalidate();
    },
    onError: () => errorAlert("Failed to mark beneficiary."),
  });

  const removeMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) =>
      (await axiosInstance.delete(`/program-eligibility/enrollments/${id}`)).data,
    onSuccess: () => {
      successAlert("Beneficiary removed.");
      invalidate();
    },
    onError: () => errorAlert("Failed to remove beneficiary."),
  });

  const busy = enrollMutation.isPending || removeMutation.isPending;
  const data = eligibilityQuery.data;

  const threshold = data?.threshold ?? 30000;
  const incomeDistribution = INCOME_BUCKETS.map((bucket) => ({
    label: bucket.label,
    count: (data?.households ?? []).filter(
      (h) => h.totalMonthlySalary >= bucket.min && h.totalMonthlySalary <= bucket.max,
    ).length,
    lowIncome: bucket.min < threshold,
  }));
  const householdSplit = data
    ? [
        { name: "Low-income", value: data.totals.lowIncomeHouseholds, color: "#f59e0b" },
        { name: "Other households", value: Math.max(data.totals.totalHouseholds - data.totals.lowIncomeHouseholds, 0), color: "#0ea5e9" },
      ].filter((row) => row.value > 0)
    : [];

  const handleEnroll = (program: "4Ps" | "TUPAD") => (member: HouseholdMember) =>
    enrollMutation.mutate({ program, censusId: member.censusId });
  const handleRemove = (enrollment: ProgramEnrollment) =>
    removeMutation.mutate({ id: enrollment._id });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
          <Wallet className="size-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Benefit Eligibility</h2>
          <p className="text-sm text-gray-500">
            Low-income households (below {data ? peso(data.threshold) : "₱30,000"}/month) for 4Ps and TUPAD.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {eligibilityQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : eligibilityQuery.isError || !data ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
            <AlertTriangle className="size-4 text-amber-500" />
            Could not compute benefit eligibility right now.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Households", value: data.totals.totalHouseholds, icon: Home },
                { label: "Low-income households", value: data.totals.lowIncomeHouseholds, icon: AlertTriangle },
                { label: "Eligible individuals", value: data.totals.lowIncomeIndividuals, icon: Users },
                { label: "Unassigned (no HH#)", value: data.totals.unassignedResidents, icon: Users },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <s.icon className="size-3.5 text-slate-400" />
                    <p className="text-xl font-bold text-gray-900">{s.value}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard
                title="Household Income Distribution"
                subtitle={`Households by total monthly income (low-income below ${peso(threshold)}/mo)`}
                icon={BarChart3}
                className="lg:col-span-2"
              >
                <div className="h-56" role="img" aria-label="Bar chart of households by monthly income bracket">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={incomeDistribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="count" name="Households" radius={[4, 4, 0, 0]}>
                        {incomeDistribution.map((row) => (
                          <Cell key={row.label} fill={row.lowIncome ? "#f59e0b" : "#0ea5e9"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Household Split" subtitle="Low-income vs other households" icon={PieChartIcon}>
                {householdSplit.length === 0 ? (
                  <div className="flex h-56 items-center justify-center text-sm text-gray-400">No households</div>
                ) : (
                  <div className="h-56" role="img" aria-label="Donut chart of low-income versus other households">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie data={householdSplit} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" nameKey="name">
                          {householdSplit.map((row) => (
                            <Cell key={row.name} fill={row.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                        <Legend verticalAlign="bottom" height={32} formatter={(value: string) => <span className="text-xs text-gray-600">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </ChartCard>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setTab("4Ps")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === "4Ps" ? "bg-sky-600 text-white" : "text-gray-500 hover:text-gray-800"}`}
              >
                <Layers className="size-3.5" />
                4Ps Batches ({data.fourPs.batchCount})
              </button>
              <button
                type="button"
                onClick={() => setTab("TUPAD")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === "TUPAD" ? "bg-sky-600 text-white" : "text-gray-500 hover:text-gray-800"}`}
              >
                <HardHat className="size-3.5" />
                TUPAD ({data.tupad.eligibleIndividuals})
              </button>
            </div>

            {data.totals.lowIncomeIndividuals === 0 ? (
              <div className="flex flex-col items-center gap-2 text-center text-gray-400 py-8">
                <BadgeCheck className="size-8 text-emerald-500" />
                <p className="text-sm font-medium">No low-income households found</p>
                <p className="text-xs">Add monthly salaries in the Resident Census to compute eligibility.</p>
              </div>
            ) : tab === "4Ps" ? (
              <div className="space-y-3">
                {data.fourPs.batches.map((batch) => (
                  <div key={batch.batchNumber} className="rounded-xl border border-slate-200/80 overflow-hidden">
                    <div className="flex items-center justify-between gap-3 bg-slate-50/70 px-3.5 py-2.5">
                      <p className="text-sm font-semibold text-gray-800">
                        Batch {batch.batchNumber}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          {batch.count} {batch.count === 1 ? "individual" : "individuals"}
                        </span>
                      </p>
                      <span className="text-xs text-gray-400">
                        {peso(batch.minHouseholdIncome)}–{peso(batch.maxHouseholdIncome)}/mo
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {batch.individuals.map((m) => (
                        <MemberRow
                          key={m.censusId}
                          member={m}
                          enrolled={enrolledByKey[`4Ps:${m.censusId}`]}
                          onEnroll={handleEnroll("4Ps")}
                          onRemove={handleRemove}
                          busy={busy}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200/80 overflow-hidden divide-y divide-slate-100 max-h-[28rem] overflow-y-auto">
                {data.tupad.individuals.map((m) => (
                  <MemberRow
                    key={m.censusId}
                    member={m}
                    enrolled={enrolledByKey[`TUPAD:${m.censusId}`]}
                    onEnroll={handleEnroll("TUPAD")}
                    onRemove={handleRemove}
                    busy={busy}
                  />
                ))}
              </div>
            )}

            {data.totals.unassignedResidents > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="size-3.5" />
                {data.totals.unassignedResidents} resident(s) have no household number and were excluded.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
