"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { TransactionItem, TreasurerDashboard } from "@/app/types/transaction.type";
import { apiErrorMessage, formatChannel, formatCurrency, formatDateTime, formatLongDate } from "@/app/utils/transactionFormat";
import { PAYMENT_VERIFICATION_CONFIG } from "@/lib/constants/status";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { DataEmpty, DataError } from "@/components/ui/data-state-renderer";
import { StatusBadge } from "@/components/ui/shared/StatusBadge";
import { CollectionTrendChart } from "@/components/reports/CollectionTrendChart";
import { PaymentMethodBadge } from "@/components/transactions/TransactionHistory";
import { TransactionDetailDialog } from "@/components/transactions/TransactionDetailDialog";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Coins,
  FileBarChart,
  Hourglass,
  LayoutDashboard,
  Receipt,
  ReceiptText,
  ShieldCheck,
  Wallet,
} from "lucide-react";

function TransactionRow({ item, onOpen }: { item: TransactionItem; onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item._id)}
      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.residentName}</p>
        <p className="text-xs text-gray-400 truncate">
          {item.documentName} · {formatChannel(item.paymentChannel)} · {formatDateTime(item.paidAt || item.transactionDate)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.amount)}</span>
        {item.verificationStatus && <StatusBadge status={item.verificationStatus} config={PAYMENT_VERIFICATION_CONFIG} className="hidden sm:inline-flex" />}
      </div>
    </button>
  );
}

export default function Page() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<TreasurerDashboard>({
    queryKey: ["transactions", "summary"],
    queryFn: async () => (await axiosInstance.get("/transactions/summary")).data,
    refetchInterval: 60000,
  });

  const stats = [
    {
      label: "Today's Collection",
      value: formatCurrency(data?.today.collected),
      hint: data ? `${data.today.verifiedCount} verified today${data.today.pendingAmount ? ` · ${formatCurrency(data.today.pendingAmount)} pending` : ""}` : "",
      icon: Coins,
      href: "/pages/treasurer/collection-reports",
      bg: "bg-gradient-to-br from-emerald-50 to-white",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      text: "text-emerald-700",
    },
    {
      label: "Transactions Today",
      value: String(data?.today.transactions ?? 0),
      hint: "Payments recorded today",
      icon: ReceiptText,
      href: "/pages/treasurer/payment-transactions",
      bg: "bg-gradient-to-br from-sky-50 to-white",
      iconBg: "bg-sky-100",
      iconColor: "text-sky-600",
      text: "text-sky-700",
    },
    {
      label: "Pending Verification",
      value: String(data?.pendingVerification.count ?? 0),
      hint: data ? `${formatCurrency(data.pendingVerification.amount)} awaiting review` : "",
      icon: Hourglass,
      href: "/pages/treasurer/payment-verification",
      bg: "bg-gradient-to-br from-amber-50 to-white",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      text: "text-amber-700",
    },
    {
      label: "Total Collected",
      value: formatCurrency(data?.totals.collected),
      hint: data ? `${formatCurrency(data.totals.monthCollected)} this month` : "",
      icon: Wallet,
      href: "/pages/treasurer/collection-reports",
      bg: "bg-gradient-to-br from-violet-50 to-white",
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
      text: "text-violet-700",
    },
  ];

  const series = (data?.lastSevenDays ?? []).map((d) => ({
    label: new Date(`${d.day}T00:00:00`).toLocaleDateString("en-PH", { weekday: "short", day: "numeric" }),
    collected: d.collected,
    pending: d.pending,
  }));

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm shrink-0">
            <LayoutDashboard className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Treasurer Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Collections and payment verification{data ? ` · ${formatLongDate(data.date)}` : ""}
            </p>
          </div>
        </div>
        {!!data?.pendingVerification.count && (
          <Link
            href="/pages/treasurer/payment-verification"
            className="flex items-center gap-2 text-sm rounded-xl px-4 py-2 border bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100 transition-colors"
          >
            <ShieldCheck className="size-4" />
            <span>
              <strong>{data.pendingVerification.count}</strong> payment{data.pendingVerification.count !== 1 ? "s" : ""} awaiting verification
            </span>
          </Link>
        )}
      </div>

      {isError ? (
        <div className="bg-white rounded-2xl border border-rose-100">
          <DataError message={apiErrorMessage(error, "Unable to load the collection summary")} refetch={refetch} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {stats.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className={`rounded-2xl border border-slate-200/80 p-4 shadow-sm ${stat.bg} hover:shadow-md transition-shadow`}
              >
                <div className={`size-8 rounded-xl flex items-center justify-center mb-2 ${stat.iconBg}`}>
                  <stat.icon className={`size-4 ${stat.iconColor}`} />
                </div>
                {isLoading ? <Skeleton className="h-7 w-24" /> : <p className={`text-xl sm:text-2xl font-bold ${stat.text} break-all`}>{stat.value}</p>}
                <p className="text-xs font-medium text-gray-600 mt-0.5">{stat.label}</p>
                {!isLoading && stat.hint && <p className="text-[11px] text-gray-400 mt-0.5">{stat.hint}</p>}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DashboardCard
              title="Collections — Last 7 Days"
              icon={BarChart3}
              className="lg:col-span-2"
              headerAction={
                <Link href="/pages/treasurer/collection-reports" className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
                  Reports <ArrowUpRight className="size-3" />
                </Link>
              }
            >
              <div className="p-4">
                {isLoading ? <Skeleton className="h-60 w-full" /> : <CollectionTrendChart rows={series} height={240} />}
                {data && (
                  <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                    <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 px-3 py-2">
                      <p className="text-gray-500">Cash collected (all time)</p>
                      <p className="text-sm font-semibold text-emerald-700">{formatCurrency(data.totals.cashCollected)}</p>
                    </div>
                    <div className="rounded-xl bg-sky-50/60 border border-sky-100 px-3 py-2">
                      <p className="text-gray-500">Online collected (all time)</p>
                      <p className="text-sm font-semibold text-sky-700">{formatCurrency(data.totals.onlineCollected)}</p>
                    </div>
                  </div>
                )}
              </div>
            </DashboardCard>

            <DashboardCard
              title="Awaiting Verification"
              icon={Hourglass}
              headerAction={
                <Link href="/pages/treasurer/payment-verification" className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
                  View all <ArrowUpRight className="size-3" />
                </Link>
              }
            >
              <div className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-5 py-3.5">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  ))
                ) : !data?.oldestPending.length ? (
                  <DataEmpty title="All caught up" description="There are no payments waiting for verification." icon={CheckCircle2} />
                ) : (
                  data.oldestPending.map((item) => <TransactionRow key={item._id} item={item} onOpen={setOpenId} />)
                )}
              </div>
            </DashboardCard>
          </div>

          <DashboardCard
            title="Recent Payment Activity"
            icon={Receipt}
            headerAction={
              <Link href="/pages/treasurer/payment-transactions" className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1">
                All transactions <ArrowUpRight className="size-3" />
              </Link>
            }
          >
            <div className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                ))
              ) : !data?.recent.length ? (
                <DataEmpty title="No payments yet" description="Recorded walk-in and online payments will appear here." icon={ReceiptText} />
              ) : (
                data.recent.map((item) => (
                  <div key={item._id} className="flex items-center">
                    <div className="flex-1 min-w-0">
                      <TransactionRow item={item} onOpen={setOpenId} />
                    </div>
                    <div className="hidden md:block pr-5">
                      <PaymentMethodBadge method={item.paymentMethod} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { title: "Verify Payments", desc: "Review walk-in and online payments", href: "/pages/treasurer/payment-verification", icon: ShieldCheck, bg: "bg-amber-50", color: "text-amber-600" },
              { title: "Receipts", desc: "Search, view, and reprint receipts", href: "/pages/treasurer/receipts", icon: Receipt, bg: "bg-sky-50", color: "text-sky-600" },
              { title: "Collection Reports", desc: "Daily, weekly, and monthly totals", href: "/pages/treasurer/collection-reports", icon: FileBarChart, bg: "bg-emerald-50", color: "text-emerald-600" },
            ].map((link) => (
              <Link key={link.title} href={link.href} className="group flex items-start gap-3 glass-card p-4 hover:border-sky-300 hover:shadow-md transition-all">
                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${link.bg}`}>
                  <link.icon className={`size-5 ${link.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 group-hover:text-sky-700 transition-colors">{link.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <TransactionDetailDialog transactionId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
