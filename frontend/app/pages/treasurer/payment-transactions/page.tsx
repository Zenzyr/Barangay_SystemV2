"use client";

import { useState } from "react";
import { TransactionHistory } from "@/components/transactions/TransactionHistory";
import { TransactionDetailDialog } from "@/components/transactions/TransactionDetailDialog";
import { ReceiptText } from "lucide-react";

export default function Page() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0 shadow-sm">
          <ReceiptText className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Payment Transactions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Walk-in and online payments for document requests, with verification status</p>
        </div>
      </div>
      <TransactionHistory scope="staff" showVerification onViewDetails={(t) => setOpenId(t._id)} />
      <TransactionDetailDialog transactionId={openId} onOpenChange={(o) => !o && setOpenId(null)} />
    </div>
  );
}
