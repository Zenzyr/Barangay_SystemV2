"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { accountInterface } from "@/app/types/account.type";
import { TransactionFilters, TransactionItem, TransactionListResponse } from "@/app/types/transaction.type";
import { DOCUMENT_OPTIONS, STATUS_CONFIG } from "@/app/utils/documentRequestOptions";
import {
  PAYMENT_METHOD_LABELS,
  REQUEST_SOURCE_LABELS,
  apiErrorMessage,
  formatChannel,
  formatCurrency,
  formatDateTime,
} from "@/app/utils/transactionFormat";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/shared/StatusBadge";
import { ReceiptDialog } from "./ReceiptDialog";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FilterX,
  Globe,
  Inbox,
  Receipt,
  Search,
  Store,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey = "date" | "amount" | "resident" | "document";
const ALL = "all";
const PAGE_SIZE = 15;

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger className="w-full h-9 border-gray-200 bg-white text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PaymentMethodBadge({ method }: { method: TransactionItem["paymentMethod"] }) {
  if (!method) return <span className="text-xs text-gray-400">—</span>;
  const online = method === "online";
  const Icon = online ? Globe : Store;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        online ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-emerald-50 text-emerald-700 border-emerald-200",
      )}
    >
      <Icon className="size-3" />
      {PAYMENT_METHOD_LABELS[method]}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: TransactionItem["paymentStatus"] }) {
  const paid = status === "paid";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        paid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200",
      )}
    >
      <Wallet className="size-3" />
      {paid ? "Paid" : "Unpaid"}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

export function TransactionHistory({ scope }: { scope: "staff" | "mine" }) {
  const isStaff = scope === "staff";
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<TransactionItem | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === (searchInput.trim() || undefined) ? f : { ...f, search: searchInput.trim() || undefined }));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const updateFilter = (key: keyof TransactionFilters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value || undefined }));
    setPage(1);
  };

  const rangeInvalid = !!(filters.from && filters.to && filters.from > filters.to);

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page, limit: PAGE_SIZE, sortBy, sortDir };
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    return p;
  }, [filters, page, sortBy, sortDir]);

  const { data, isLoading, isError, error, isFetching } = useQuery<TransactionListResponse>({
    queryKey: ["transactions", scope, params],
    queryFn: async () => (await axiosInstance.get(isStaff ? "/transactions" : "/transactions/mine", { params })).data,
    placeholderData: keepPreviousData,
    enabled: !rangeInvalid,
  });

  const { data: residents = [] } = useQuery<accountInterface[]>({
    queryKey: ["accounts", "approved"],
    queryFn: async () => {
      const res = await axiosInstance.get("/account", { params: { status: "approved" } });
      return (res.data || []).filter((a: accountInterface) => a.role === "resident");
    },
    enabled: isStaff,
  });

  const residentOptions = useMemo(
    () => residents.map((r) => ({ value: r._id, label: r.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [residents],
  );

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir(key === "resident" || key === "document" ? "asc" : "desc");
    }
    setPage(1);
  };

  const hasFilters = !!searchInput || Object.values(filters).some(Boolean);
  const clearFilters = () => {
    setSearchInput("");
    setFilters({});
    setPage(1);
  };

  const sortHead = (label: string, sortKey: SortKey, className?: string) => {
    const active = sortBy === sortKey;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead key={sortKey} className={cn("text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80", className)}>
        <button type="button" onClick={() => toggleSort(sortKey)} className={cn("inline-flex items-center gap-1 hover:text-slate-800", active && "text-slate-800")}>
          {label}
          <Icon className="size-3" />
        </button>
      </TableHead>
    );
  };

  const items = data?.items ?? [];
  const colSpan = isStaff ? 8 : 7;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Paid", value: formatCurrency(data?.summary.paidAmount), tone: "text-emerald-700" },
          { label: "Paid Transactions", value: data?.summary.paidCount ?? 0, tone: "text-sky-700" },
          { label: "Outstanding", value: formatCurrency(data?.summary.unpaidAmount), tone: "text-amber-700" },
          { label: "Unpaid Requests", value: data?.summary.unpaidCount ?? 0, tone: "text-rose-700" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{card.label}</p>
            {isLoading ? <Skeleton className="h-6 w-20 mt-2" /> : <p className={cn("text-lg sm:text-xl font-bold mt-1", card.tone)}>{card.value}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <Input
              placeholder={isStaff ? "Search receipt no., reference, resident, or email..." : "Search receipt or reference number..."}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 h-9 border-gray-200"
            />
          </div>
          {hasFilters && (
            <Button variant="outline" onClick={clearFilters} className="h-9 gap-1.5 border-gray-200 text-gray-600">
              <FilterX className="size-4" /> Clear filters
            </Button>
          )}
        </div>
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3", isStaff ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">From</label>
            <Input type="date" value={filters.from || ""} max={filters.to || undefined} onChange={(e) => updateFilter("from", e.target.value)} className="h-9 border-gray-200" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">To</label>
            <Input type="date" value={filters.to || ""} min={filters.from || undefined} onChange={(e) => updateFilter("to", e.target.value)} className="h-9 border-gray-200" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Payment method</label>
            <FilterSelect
              value={filters.paymentMethod || ""}
              onChange={(v) => updateFilter("paymentMethod", v)}
              placeholder="All methods"
              options={[
                { value: "over-the-counter", label: "Over-the-Counter" },
                { value: "online", label: "Online" },
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Payment status</label>
            <FilterSelect
              value={filters.paymentStatus || ""}
              onChange={(v) => updateFilter("paymentStatus", v)}
              placeholder="All statuses"
              options={[
                { value: "paid", label: "Paid" },
                { value: "unpaid", label: "Unpaid" },
              ]}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Document</label>
            <FilterSelect value={filters.document || ""} onChange={(v) => updateFilter("document", v)} placeholder="All documents" options={[...DOCUMENT_OPTIONS]} />
          </div>
          {isStaff && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-500">Resident</label>
              <FilterSelect value={filters.resident || ""} onChange={(v) => updateFilter("resident", v)} placeholder="All residents" options={residentOptions} />
            </div>
          )}
        </div>
        {rangeInvalid && <p className="text-xs text-rose-600">The start date must be on or before the end date.</p>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Reference</TableHead>
                {isStaff && sortHead("Resident", "resident")}
                {sortHead("Document", "document", "hidden md:table-cell")}
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Method</TableHead>
                {sortHead("Amount", "amount")}
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Status</TableHead>
                {sortHead("Date", "date", "hidden lg:table-cell")}
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: colSpan }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-14 text-sm text-rose-600">
                    {apiErrorMessage(error, "Failed to load transactions.")}
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                        <Inbox className="size-6" />
                      </div>
                      <p className="text-sm font-medium">{hasFilters ? "No transactions match your filters" : "No transactions yet"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((t) => (
                  <TableRow key={t._id} className={cn("hover:bg-slate-50/60 transition-colors", isFetching && "opacity-70")}>
                    <TableCell>
                      <p className="font-mono text-xs font-semibold text-gray-900">{t.receiptNumber || `REQ-${t._id.slice(-6).toUpperCase()}`}</p>
                      <p className="text-[11px] text-gray-400">{REQUEST_SOURCE_LABELS[t.requestSource]} request</p>
                    </TableCell>
                    {isStaff && (
                      <TableCell>
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">{t.residentName}</p>
                        {t.residentEmail && <p className="text-[11px] text-gray-400 truncate max-w-[160px]">{t.residentEmail}</p>}
                      </TableCell>
                    )}
                    <TableCell className="hidden md:table-cell text-sm text-gray-600">{t.documentName}</TableCell>
                    <TableCell>
                      <PaymentMethodBadge method={t.paymentMethod} />
                    </TableCell>
                    <TableCell className="text-sm font-semibold text-gray-900">{formatCurrency(t.amount)}</TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={t.paymentStatus} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-gray-500">{formatDateTime(t.transactionDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetail(t)}
                          className="inline-flex h-7 items-center gap-1 px-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          <Eye className="size-3" /> Details
                        </button>
                        <button
                          type="button"
                          disabled={!t.receiptAvailable}
                          onClick={() => setReceiptId(t._id)}
                          title={t.receiptAvailable ? "View receipt" : "Receipt available once paid"}
                          className="inline-flex h-7 items-center gap-1 px-2 rounded-lg text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:text-gray-300 disabled:hover:bg-transparent"
                        >
                          <Receipt className="size-3" /> Receipt
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {data && data.total > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>
              Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 border-gray-200" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2">
                Page {data.page} of {data.pages}
              </span>
              <Button variant="outline" size="sm" className="h-8 border-gray-200" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-gray-900">Transaction Details</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">{detail?.documentName}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div>
              <DetailRow label="Receipt No." value={detail.receiptNumber || "Not issued"} />
              <DetailRow label="Payment Reference" value={detail.paymentReference || "—"} />
              <DetailRow label="Resident" value={detail.residentName} />
              <DetailRow label="Document" value={detail.documentName} />
              <DetailRow label="Request Type" value={`${REQUEST_SOURCE_LABELS[detail.requestSource]} request`} />
              <DetailRow label="Payment Method" value={<PaymentMethodBadge method={detail.paymentMethod} />} />
              <DetailRow label="Payment Channel" value={formatChannel(detail.paymentChannel)} />
              <DetailRow label="Amount" value={formatCurrency(detail.amount)} />
              {detail.amountTendered !== null && <DetailRow label="Amount Tendered" value={formatCurrency(detail.amountTendered)} />}
              {detail.changeGiven !== null && <DetailRow label="Change" value={formatCurrency(detail.changeGiven)} />}
              <DetailRow label="Payment Status" value={<PaymentStatusBadge status={detail.paymentStatus} />} />
              <DetailRow label="Request Status" value={<StatusBadge status={detail.requestStatus} config={STATUS_CONFIG} />} />
              <DetailRow label="Paid At" value={formatDateTime(detail.paidAt)} />
              <DetailRow label="Requested" value={detail.requestDate || "—"} />
              {detail.receiptAvailable && (
                <Button
                  onClick={() => {
                    setReceiptId(detail._id);
                    setDetail(null);
                  }}
                  className="w-full mt-4 h-10 gap-2 bg-gradient-to-r from-sky-500 to-emerald-500 text-white"
                >
                  <Receipt className="size-4" /> View Receipt
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ReceiptDialog open={!!receiptId} onOpenChange={(o) => !o && setReceiptId(null)} requestId={receiptId} />
    </div>
  );
}
