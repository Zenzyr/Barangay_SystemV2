"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { TreasurerDashboard, VerificationStatus } from "@/app/types/transaction.type";
import { formatCurrency } from "@/app/utils/transactionFormat";
import { PAYMENT_VERIFICATION_CONFIG } from "@/lib/constants/status";
import { TransactionHistory } from "@/components/transactions/TransactionHistory";
import { TransactionDetailDialog } from "@/components/transactions/TransactionDetailDialog";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: VerificationStatus[] = ["pending", "verified", "rejected"];

export default function Page() {
  const [tab, setTab] = useState<VerificationStatus>("pending");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: summary } = useQuery<TreasurerDashboard>({
    queryKey: ["transactions", "summary"],
    queryFn: async () => (await axiosInstance.get("/transactions/summary")).data,
  });

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-amber-100 to-emerald-100 text-amber-600 flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Payment Verification</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review recorded payments. Only verified payments are counted as collected.
            {summary && summary.pendingVerification.count > 0 && (
              <> {summary.pendingVerification.count} pending · {formatCurrency(summary.pendingVerification.amount)}</>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
        {TABS.map((t) => {
          const cfg = PAYMENT_VERIFICATION_CONFIG[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                tab === t ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700",
              )}
            >
              <cfg.icon className="size-4" />
              {t === "pending" ? "Pending" : cfg.label}
              {t === "pending" && !!summary?.pendingVerification.count && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-700">{summary.pendingVerification.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <TransactionHistory
        key={tab}
        scope="staff"
        showVerification
        baseFilters={{ verificationStatus: tab }}
        hiddenFilters={["paymentStatus"]}
        onViewDetails={(t) => setOpenId(t._id)}
      />
      <TransactionDetailDialog transactionId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
