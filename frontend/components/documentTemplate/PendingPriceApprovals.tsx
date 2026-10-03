"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CheckCircle2, Clock, Gavel, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DataEmpty, DataError } from "@/components/ui/data-state-renderer";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { cn } from "@/lib/utils";
import {
  approveTemplatePrice,
  getPendingPriceApprovals,
  getPriceDecisionHistory,
  rejectTemplatePrice,
  type DocumentTemplate,
  type PriceDecision,
} from "@/app/utils/documentTemplateService";

export const PENDING_PRICE_APPROVALS_KEY = ["document-template-pending-approvals"] as const;
const PRICE_DECISIONS_KEY = ["document-template-price-decisions"] as const;

export function usePendingPriceApprovals() {
  return useQuery({
    queryKey: PENDING_PRICE_APPROVALS_KEY,
    queryFn: getPendingPriceApprovals,
  });
}

export const formatPeso = (value: number | null | undefined, currency = "PHP") =>
  value === null || value === undefined || Number.isNaN(value)
    ? "—"
    : new Intl.NumberFormat("en-PH", { style: "currency", currency: currency || "PHP" }).format(value);

const formatDateTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

const proposerName = (t: DocumentTemplate) =>
  typeof t.pendingFeeProposedBy === "object" && t.pendingFeeProposedBy ? t.pendingFeeProposedBy.name : "—";

type BadgeStatus = "pending" | "approved" | "rejected";

const STATUS_BADGE: Record<BadgeStatus, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending approval", className: "bg-amber-50 text-amber-700 ring-amber-200", icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-rose-50 text-rose-700 ring-rose-200", icon: XCircle },
};

export function PriceStatusBadge({ status }: { status: BadgeStatus }) {
  const cfg = STATUS_BADGE[status];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1", cfg.className)}>
      <cfg.icon className="size-3" />
      {cfg.label}
    </span>
  );
}

function Difference({ current, proposed, currency }: { current: number; proposed?: number; currency?: string }) {
  if (proposed === undefined || proposed === null) return <span className="text-slate-400">—</span>;
  const diff = proposed - current;
  const pct = current > 0 ? (diff / current) * 100 : null;
  const tone = diff > 0 ? "text-amber-700" : diff < 0 ? "text-sky-700" : "text-slate-500";
  return (
    <span className={cn("whitespace-nowrap font-medium tabular-nums", tone)}>
      {diff > 0 ? "+" : diff < 0 ? "−" : ""}
      {formatPeso(Math.abs(diff), currency)}
      {pct !== null && diff !== 0 ? <span className="ml-1 text-xs font-normal text-slate-500">({diff > 0 ? "+" : "−"}{Math.abs(pct).toFixed(1)}%)</span> : null}
    </span>
  );
}

function DecisionActions({ template }: { template: DocumentTemplate }) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: PENDING_PRICE_APPROVALS_KEY });
    queryClient.invalidateQueries({ queryKey: PRICE_DECISIONS_KEY });
    queryClient.invalidateQueries({ queryKey: ["document-templates"] });
  };
  const approve = useMutation({
    mutationFn: approveTemplatePrice,
    onSuccess: () => {
      successAlert("Price change approved and now active.");
      invalidate();
    },
    onError: () => errorAlert("Failed to approve price change."),
  });
  const reject = useMutation({
    mutationFn: rejectTemplatePrice,
    onSuccess: () => {
      successAlert("Price change rejected. The active price is unchanged.");
      invalidate();
    },
    onError: () => errorAlert("Failed to reject price change."),
  });
  const busy = approve.isPending || reject.isPending;
  return (
    <div className="flex justify-end gap-2 whitespace-nowrap">
      <Button
        size="sm"
        variant="outline"
        className="h-8 border-rose-200 text-xs text-rose-600 hover:bg-rose-50"
        disabled={busy}
        onClick={() => reject.mutate(template._id)}
      >
        {reject.isPending ? <Loader2 className="size-3 animate-spin" /> : <XCircle className="size-3" />}
        Reject
      </Button>
      <Button
        size="sm"
        className="h-8 bg-gradient-to-r from-emerald-500 to-emerald-600 text-xs text-white hover:from-emerald-600 hover:to-emerald-700"
        disabled={busy}
        onClick={() => approve.mutate(template._id)}
      >
        {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
        Approve
      </Button>
    </div>
  );
}

function RecentDecisions() {
  const { data = [], isLoading, isError, refetch } = useQuery<PriceDecision[]>({
    queryKey: PRICE_DECISIONS_KEY,
    queryFn: () => getPriceDecisionHistory(6),
  });

  return (
    <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent decisions</h3>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <DataError message="Unable to load recent price decisions" refetch={refetch} />
      ) : data.length === 0 ? (
        <p className="text-sm text-slate-400">No price changes have been approved or rejected yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((d) => (
            <li key={d.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{d.templateName}</p>
                <p className="text-xs text-slate-500">
                  {d.status === "approved"
                    ? `${formatPeso(d.previousFee)} → ${formatPeso(d.proposedFee)} is now active`
                    : `Proposed ${formatPeso(d.proposedFee)} was not applied · ${formatPeso(d.activeFee)} remains active`}
                  {` · ${d.decidedBy} · ${formatDateTime(d.decidedAt)}`}
                </p>
              </div>
              <PriceStatusBadge status={d.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PendingPriceApprovals({
  canDecide = false,
  showHistory = true,
  description,
}: {
  canDecide?: boolean;
  showHistory?: boolean;
  description?: string;
}) {
  const { data: pending = [], isLoading, isError, refetch } = usePendingPriceApprovals();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" aria-labelledby="pending-price-approvals-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 id="pending-price-approvals-title" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Gavel className="size-4 text-amber-600" />
            Pending Price Approvals
            {!isLoading && !isError ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 tabular-nums">{pending.length}</span>
            ) : null}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {description ??
              (canDecide
                ? "Approve to make the proposed price active, or reject to keep the current price."
                : "Proposed prices take effect only after Super Admin approval. The current price stays active until then.")}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-4 sm:p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <div className="p-4 sm:p-5">
          <DataError message="Unable to load pending price approvals" refetch={refetch} />
        </div>
      ) : pending.length === 0 ? (
        <div className="p-4 sm:p-5">
          <DataEmpty title="No pending price approvals" description="All document prices are up to date." icon={CheckCircle2} />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2.5 font-semibold">Document template</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Current price</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Proposed price</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Difference</th>
                  <th className="px-3 py-2.5 font-semibold">Requested by</th>
                  {canDecide ? null : <th className="px-3 py-2.5 font-semibold">Status</th>}
                  {canDecide ? <th className="px-5 py-2.5 text-right font-semibold">Decision</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50/60">
                    <td className="max-w-[14rem] px-5 py-3">
                      <p className="truncate font-medium text-slate-800" title={t.name}>{t.name}</p>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {formatPeso(t.fee, t.currency)}
                      <span className="block text-[11px] text-emerald-600">Active</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-amber-700">{formatPeso(t.pendingFee, t.currency)}</td>
                    <td className="px-3 py-3 text-right">
                      <Difference current={t.fee} proposed={t.pendingFee} currency={t.currency} />
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-slate-700">{proposerName(t)}</p>
                      <p className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(t.pendingFeeProposedAt)}</p>
                    </td>
                    {canDecide ? null : (
                      <td className="px-3 py-3">
                        <PriceStatusBadge status="pending" />
                      </td>
                    )}
                    {canDecide ? (
                      <td className="px-5 py-3">
                        <DecisionActions template={t} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {pending.map((t) => (
              <li key={t._id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium text-slate-800" title={t.name}>{t.name}</p>
                  <PriceStatusBadge status="pending" />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-slate-400">Current (active)</dt>
                  <dd className="text-right tabular-nums text-slate-700">{formatPeso(t.fee, t.currency)}</dd>
                  <dt className="text-slate-400">Proposed</dt>
                  <dd className="text-right font-semibold tabular-nums text-amber-700">{formatPeso(t.pendingFee, t.currency)}</dd>
                  <dt className="text-slate-400">Difference</dt>
                  <dd className="text-right">
                    <Difference current={t.fee} proposed={t.pendingFee} currency={t.currency} />
                  </dd>
                  <dt className="text-slate-400">Requested by</dt>
                  <dd className="truncate text-right text-slate-600">{proposerName(t)}</dd>
                  <dt className="text-slate-400">Requested</dt>
                  <dd className="text-right text-slate-500">{formatDateTime(t.pendingFeeProposedAt)}</dd>
                </dl>
                {canDecide ? <DecisionActions template={t} /> : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {showHistory ? <RecentDecisions /> : null}
    </section>
  );
}

export function PendingPriceApprovalsSummary({ href, limit = 3 }: { href: string; limit?: number }) {
  const { data: pending = [], isLoading, isError, refetch } = usePendingPriceApprovals();
  const recent = pending.slice(0, limit);

  return (
    <DashboardCard
      title="Pending Price Approvals"
      icon={Gavel}
      headerAction={
        <Link href={href} className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700">
          View approvals <ArrowUpRight className="size-3" />
        </Link>
      }
    >
      {isLoading ? (
        <div className="space-y-2 px-5 py-4">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : isError ? (
        <DataError message="Unable to load pending price approvals" refetch={refetch} />
      ) : pending.length === 0 ? (
        <DataEmpty title="No pending price approvals" description="All document prices are up to date." icon={CheckCircle2} />
      ) : (
        <div>
          <Link href={href} className="flex items-baseline gap-2 px-5 pt-4 pb-2 hover:opacity-80">
            <span className="text-2xl font-bold tabular-nums text-amber-700">{pending.length}</span>
            <span className="text-xs text-gray-500">{pending.length === 1 ? "item awaiting" : "items awaiting"} Super Admin approval</span>
          </Link>
          <ul className="divide-y divide-gray-100">
            {recent.map((t) => (
              <li key={t._id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-800" title={t.name}>{t.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatPeso(t.fee, t.currency)} → <span className="font-medium text-amber-700">{formatPeso(t.pendingFee, t.currency)}</span>
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-gray-400">{formatDateTime(t.pendingFeeProposedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
