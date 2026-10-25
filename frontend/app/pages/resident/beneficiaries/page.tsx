"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProgramBeneficiariesResult,
  PublicBeneficiary,
} from "@/app/types/programEligibility.type";
import {
  BadgeCheck,
  HardHat,
  Layers,
  Users,
  Home,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

function peso(value: number): string {
  return `₱${Number(value || 0).toLocaleString("en-PH")}`;
}

function BeneficiaryRow({ person }: { person: PublicBeneficiary }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {person.name}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Home className="size-3" />
            {person.householdNumber}
          </span>
          <span>·</span>
          <span>{person.purok}</span>
          <span>·</span>
          <span>Household {peso(person.householdTotalIncome)}/mo</span>
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
        <BadgeCheck className="size-3.5" />
        Eligible
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-gray-50">
        <BadgeCheck className="size-6 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-500">{message}</p>
      <p className="text-xs text-gray-400">
        Beneficiaries are added automatically once a household qualifies.
      </p>
    </div>
  );
}

function BatchCard({
  batch,
}: {
  batch: { batchNumber: number; count: number; individuals: PublicBeneficiary[] };
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-slate-50/70 px-4 py-3">
        <p className="text-sm font-semibold text-gray-800">
          Batch {batch.batchNumber}
          <span className="ml-2 text-xs font-normal text-gray-500">
            {batch.count} {batch.count === 1 ? "individual" : "individuals"}
          </span>
        </p>
        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
          <Users className="size-3.5" />
          {batch.count}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {batch.individuals.map((person) => (
          <BeneficiaryRow key={person.censusId} person={person} />
        ))}
      </div>
    </div>
  );
}

export default function Page() {
  const [tab, setTab] = useState<"4Ps" | "TUPAD">("4Ps");

  const { data, isLoading, isError, refetch, isFetching } =
    useQuery<ProgramBeneficiariesResult>({
      queryKey: ["public-beneficiaries"],
      queryFn: async () => {
        const res = await axiosInstance.get("/program-eligibility/beneficiaries");
        return res.data;
      },
    });

  const totalHouseholds = useMemo(() => {
    if (!data) return 0;
    const set = new Set<string>();
    data.fourPs.batches.forEach((b) =>
      b.individuals.forEach((p) => set.add(p.householdNumber)),
    );
    data.tupad.individuals.forEach((p) => set.add(p.householdNumber));
    return set.size;
  }, [data]);

  return (
    <div className="w-full min-h-dvh space-y-6 p-4 sm:p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600">
          <BadgeCheck className="size-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Program Beneficiaries
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Automatically selected low-income households for 4Ps and TUPAD
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Transparency note ── */}
      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>
          The system picks beneficiaries automatically from each household&apos;s
          total monthly income. 4Ps lists one representative per low-income
          household; the remaining members are listed under TUPAD. Brgy.
          officials do not choose the list — it is shown here for transparency.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white py-14 text-center">
          <AlertTriangle className="size-8 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-gray-700">
              Could not load beneficiaries
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Please check your connection and try again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/* ── Summary ── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: "Low-income threshold",
                value: `Below ${peso(data.threshold)}/mo`,
                icon: Home,
              },
              {
                label: "Households covered",
                value: totalHouseholds,
                icon: Home,
              },
              {
                label: "4Ps representatives",
                value: data.fourPs.eligibleIndividuals,
                icon: Layers,
              },
              {
                label: "TUPAD members",
                value: data.tupad.eligibleIndividuals,
                icon: HardHat,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-3"
              >
                <div className="flex items-center gap-1.5">
                  <stat.icon className="size-3.5 text-slate-400" />
                  <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setTab("4Ps")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === "4Ps"
                  ? "bg-sky-600 text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Layers className="size-3.5" />
              4Ps ({data.fourPs.eligibleIndividuals})
            </button>
            <button
              type="button"
              onClick={() => setTab("TUPAD")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                tab === "TUPAD"
                  ? "bg-sky-600 text-white"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <HardHat className="size-3.5" />
              TUPAD ({data.tupad.eligibleIndividuals})
            </button>
          </div>

          {/* ── Lists ── */}
          {tab === "4Ps" ? (
            data.fourPs.batches.length === 0 ? (
              <EmptyState message="No 4Ps beneficiaries" />
            ) : (
              <div className="space-y-3">
                {data.fourPs.batches.map((batch) => (
                  <BatchCard key={batch.batchNumber} batch={batch} />
                ))}
              </div>
            )
          ) : data.tupad.batches.length === 0 ? (
            <EmptyState message="No TUPAD beneficiaries" />
          ) : (
            <div className="space-y-3">
              {data.tupad.batches.map((batch) => (
                <BatchCard key={batch.batchNumber} batch={batch} />
              ))}
            </div>
          )}

          <p className="py-2 text-center text-xs text-gray-400">
            Last updated{" "}
            {data.generatedAt
              ? new Date(data.generatedAt).toLocaleString("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
          </p>
        </>
      )}
    </div>
  );
}
