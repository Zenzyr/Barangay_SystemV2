"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { TransactionItem, TransactionListResponse } from "@/app/types/transaction.type";
import { formatCurrency } from "@/app/utils/transactionFormat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RecordPaymentDialog } from "./components/RecordPaymentDialog";
import { HandCoins, Search, Inbox, Banknote, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const SOURCE_TABS: { value: "all" | "walk-in" | "online"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "walk-in", label: "Walk-in" },
  { value: "online", label: "Dashboard" },
];

const formatRequestDate = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

export default function Page() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | "walk-in" | "online">("all");
  const [selected, setSelected] = useState<TransactionItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<TransactionListResponse>({
    queryKey: ["transactions", "list", "collect-unpaid", source],
    queryFn: async () => {
      const res = await axiosInstance.get("/transactions", {
        params: {
          paymentStatus: "unpaid",
          limit: 100,
          ...(source !== "all" ? { source } : {}),
        },
      });
      return res.data;
    },
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) => t.residentName.toLowerCase().includes(q) || t.transactionNumber.toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-amber-100 to-emerald-100 text-amber-600 flex items-center justify-center shrink-0 shadow-sm">
          <HandCoins className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Walk-in Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Record cash payments for walk-in and dashboard (online) document requests. Once paid, the secretary can print the document.
          </p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
        {SOURCE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setSource(t.value)}
            className={cn(
              "flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              source === t.value ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or reference..."
              className="pl-9 h-9 border-slate-200 focus:border-sky-400 focus:ring-sky-400/20"
            />
          </div>
          <p className="text-xs text-slate-400 sm:ml-auto">
            {items.length} unpaid request{items.length !== 1 ? "s" : ""}
          </p>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-500">Unable to load walk-in payments.</p>
            <Button variant="outline" size="sm" className="mt-3 border-slate-200" onClick={() => refetch()}>
              <RefreshCw className="size-3.5 mr-1.5" />
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Inbox className="size-8 mx-auto text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">No unpaid requests</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Unpaid walk-in and dashboard document requests will appear here for you to collect payment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Resident</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Document</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Requested</TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Amount Due</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((t) => (
                  <TableRow key={t._id}>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-800">{t.residentName}</p>
                      <p className="text-xs text-slate-400">{t.transactionNumber}</p>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{t.documentName}</TableCell>
                    <TableCell className="text-sm text-slate-500">{formatRequestDate(t.transactionDate)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-800">
                      {formatCurrency(t.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelected(t);
                          setDialogOpen(true);
                        }}
                        className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs"
                      >
                        <Banknote className="size-3.5 mr-1.5" />
                        Record Payment
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <RecordPaymentDialog
        key={selected?._id ?? "none"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={selected}
      />
    </div>
  );
}