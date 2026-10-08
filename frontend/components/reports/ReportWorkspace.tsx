"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import useUserStore from "@/app/store/useUserStore";
import { CollectionPeriod, ReportFilters, ReportResponse, ReportType } from "@/app/types/report.type";
import { DOCUMENT_NAMES, DOCUMENT_OPTIONS, STATUS_CONFIG } from "@/app/utils/documentRequestOptions";
import { apiErrorMessage, formatCurrency } from "@/app/utils/transactionFormat";
import { WORK_STATUS_CONFIG, WORK_STATUS_OPTIONS, toDateKey } from "@/app/utils/workRequest";
import { PDF_PAGE_SIZES, exportPagesToPdf } from "@/app/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS, hasPermission } from "@/lib/constants/roles";
import { PAYMENT_VERIFICATION_CONFIG } from "@/lib/constants/status";
import { COLLECTION_PERIOD_LABELS, REPORT_COLUMNS, ReportRow, breakdowns, summaryStats } from "./reportColumns";
import { ReportPrintLayout } from "./reportPrintLayout";
import { CollectionTrendChart } from "./CollectionTrendChart";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileBarChart,
  FileText,
  Hammer,
  Inbox,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Wallet,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ALL = "all";
const PAGE_SIZE = 20;

const REPORT_TYPES: { value: ReportType; label: string; title: string; icon: typeof FileText; dateLabel: string }[] = [
  { value: "documents", label: "Document Requests", title: "Document Requests Report", icon: FileText, dateLabel: "Request date" },
  { value: "payments", label: "Payments & Revenue", title: "Payments & Revenue Report", icon: Wallet, dateLabel: "Payment date" },
  { value: "work", label: "Work Requests", title: "Work Requests Report", icon: Hammer, dateLabel: "Created date" },
  { value: "collections", label: "Collections", title: "Collection Report", icon: Coins, dateLabel: "Payment date" },
];

const COLLECTION_PERIODS: CollectionPeriod[] = ["daily", "weekly", "monthly"];

const TONE_CLASS: Record<string, string> = {
  default: "text-gray-900",
  success: "text-emerald-700",
  warning: "text-amber-700",
  danger: "text-rose-700",
  info: "text-sky-700",
};

function defaultFilters(): ReportFilters {
  const now = new Date();
  return { from: toDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateKey(now) };
}

function FilterSelect({ label, value, onChange, placeholder, options }: { label: string; value?: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-medium text-gray-500">{label}</label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger className="w-full h-9 border-gray-200 bg-white text-sm">
          <SelectValue />
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
    </div>
  );
}

function formatPeriod(filters: ReportFilters) {
  const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
  if (filters.from && filters.to) return `${fmt(filters.from)} – ${fmt(filters.to)}`;
  if (filters.from) return `From ${fmt(filters.from)}`;
  if (filters.to) return `Up to ${fmt(filters.to)}`;
  return "All dates";
}

function filterLabels(type: ReportType, filters: ReportFilters) {
  const out: { label: string; value: string }[] = [];
  const dateLabel = REPORT_TYPES.find((t) => t.value === type)?.dateLabel || "Date";
  if (filters.from || filters.to) out.push({ label: dateLabel, value: formatPeriod(filters) });
  if (filters.document) out.push({ label: "Document", value: DOCUMENT_NAMES[filters.document] || filters.document });
  if (filters.source) out.push({ label: "Request type", value: filters.source === "walk-in" ? "Walk-in" : "Online" });
  if (filters.status) {
    out.push({ label: "Status", value: (type === "work" ? WORK_STATUS_CONFIG[filters.status]?.label : STATUS_CONFIG[filters.status]?.label) || filters.status });
  }
  if (filters.paymentStatus) out.push({ label: "Payment status", value: filters.paymentStatus === "paid" ? "Paid" : "Unpaid" });
  if (filters.paymentMethod) out.push({ label: "Payment method", value: filters.paymentMethod === "online" ? "Online" : "Over-the-Counter" });
  if (filters.verificationStatus) out.push({ label: "Verification", value: PAYMENT_VERIFICATION_CONFIG[filters.verificationStatus]?.label || filters.verificationStatus });
  if (filters.kind) out.push({ label: "Work type", value: filters.kind === "booking" ? "Booking" : "Service Contract" });
  if (filters.search) out.push({ label: "Search", value: `"${filters.search}"` });
  return out;
}

export function ReportWorkspace({
  types,
  title = "Reports",
  subtitle = "Generate filtered summaries and export them as PDF",
}: {
  types: ReportType[];
  title?: string;
  subtitle?: string;
}) {
  const settingsStore = useBarangaySettingsStore();
  const role = useUserStore((s) => s.user?.role);
  const availableTypes = REPORT_TYPES.filter((t) => types.includes(t.value));
  const [type, setType] = useState<ReportType>(types[0]);
  const [collectionPeriod, setCollectionPeriod] = useState<CollectionPeriod>("daily");
  const [draft, setDraft] = useState<ReportFilters>(defaultFilters);
  const [applied, setApplied] = useState<ReportFilters>(defaultFilters);
  const [tableSearch, setTableSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { load: loadSettings } = settingsStore;
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const rangeInvalid = !!(draft.from && draft.to && draft.from > draft.to);

  const params = useMemo(() => {
    const p: Record<string, string> = { type };
    for (const [k, v] of Object.entries(applied)) if (v) p[k] = String(v);
    return p;
  }, [type, applied]);

  const { data: report, isLoading, isError, error, isFetching, refetch } = useQuery<ReportResponse>({
    queryKey: ["reports", params],
    queryFn: async () => (await axiosInstance.get("/reports", { params })).data,
  });

  const columns = REPORT_COLUMNS[type];
  const typeMeta = REPORT_TYPES.find((t) => t.value === type)!;

  const rows: ReportRow[] = useMemo(() => {
    if (!report || report.type !== type) return [];
    let list = [...(report.rows as ReportRow[])];
    const q = tableSearch.trim().toLowerCase();
    if (q) list = list.filter((r) => columns.some((c) => c.value(r).toLowerCase().includes(q)));
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        const get = col.sortValue ?? col.value;
        list.sort((a, b) => {
          const va = get(a);
          const vb = get(b);
          const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    return list;
  }, [report, type, tableSearch, sortKey, sortDir, columns]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const changeType = (next: ReportType) => {
    setType(next);
    const base = { from: draft.from, to: draft.to };
    setDraft(base);
    setApplied(base);
    setTableSearch("");
    setSortKey(null);
    setPage(1);
  };

  const setDraftField = (key: keyof ReportFilters, value: string) => setDraft((d) => ({ ...d, [key]: value || undefined }));

  const generate = () => {
    if (rangeInvalid) return;
    const next = { ...draft, search: draft.search?.trim() || undefined };
    setPage(1);
    if (JSON.stringify(next) === JSON.stringify(applied)) refetch();
    else setApplied(next);
  };

  const reset = () => {
    const base = defaultFilters();
    setDraft(base);
    setApplied(base);
    setTableSearch("");
    setSortKey(null);
    setPage(1);
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const exportPdf = async () => {
    if (!report) return;
    flushSync(() => setExporting(true));
    try {
      const root = printRef.current;
      if (!root) throw new Error("Report layout is not ready");
      await Promise.all(
        Array.from(root.querySelectorAll("img")).map((img) =>
          img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
        ),
      );
      const pageEls = Array.from(root.querySelectorAll<HTMLElement>("[data-report-page]"));
      const stamp = toDateKey(new Date());
      await exportPagesToPdf(pageEls, `${type}-report-${applied.from || "all"}-to-${applied.to || stamp}.pdf`, {
        pageSize: PDF_PAGE_SIZES.a4Landscape,
        title: typeMeta.title,
      });
      toast.success("Report PDF downloaded");
    } catch {
      toast.error("Failed to generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const reportReady = !!report && report.type === type;
  const stats = reportReady ? summaryStats(report) : [];
  const tables = reportReady ? breakdowns(report, collectionPeriod) : [];
  const canExport = type !== "collections" || hasPermission(role, PERMISSIONS.COLLECTION_REPORTS_EXPORT);
  const appliedLabels = filterLabels(type, applied);
  const barangay = settingsStore.settings?.barangay;

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0 shadow-sm">
            <FileBarChart className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {canExport && (
        <Button
          onClick={exportPdf}
          disabled={!reportReady || exporting || isFetching}
          className="h-10 gap-2 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white"
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {exporting ? "Preparing PDF..." : "Download PDF"}
        </Button>
        )}
      </div>

      {availableTypes.length > 1 && (
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto">
        {availableTypes.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => changeType(t.value)}
            className={cn(
              "flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              type === t.value ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">{typeMeta.dateLabel} from</label>
            <Input type="date" value={draft.from || ""} max={draft.to || undefined} onChange={(e) => setDraftField("from", e.target.value)} className="h-9 border-gray-200" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">{typeMeta.dateLabel} to</label>
            <Input type="date" value={draft.to || ""} min={draft.from || undefined} onChange={(e) => setDraftField("to", e.target.value)} className="h-9 border-gray-200" />
          </div>
          {type !== "work" && (
            <FilterSelect label="Document type" value={draft.document} onChange={(v) => setDraftField("document", v)} placeholder="All documents" options={[...DOCUMENT_OPTIONS]} />
          )}
          {type !== "work" && (
            <FilterSelect
              label="Request type"
              value={draft.source}
              onChange={(v) => setDraftField("source", v)}
              placeholder="Walk-in & online"
              options={[
                { value: "walk-in", label: "Walk-in" },
                { value: "online", label: "Online" },
              ]}
            />
          )}
          {type === "documents" && (
            <FilterSelect
              label="Request status"
              value={draft.status}
              onChange={(v) => setDraftField("status", v)}
              placeholder="All statuses"
              options={["pending", "processing", "ready", "released", "cancelled", "rejected"].map((s) => ({ value: s, label: STATUS_CONFIG[s].label }))}
            />
          )}
          {type === "collections" && (
            <FilterSelect
              label="Verification status"
              value={draft.verificationStatus}
              onChange={(v) => setDraftField("verificationStatus", v)}
              placeholder="All statuses"
              options={["verified", "pending", "rejected"].map((s) => ({ value: s, label: PAYMENT_VERIFICATION_CONFIG[s].label }))}
            />
          )}
          {type === "documents" && (
            <FilterSelect
              label="Payment status"
              value={draft.paymentStatus}
              onChange={(v) => setDraftField("paymentStatus", v)}
              placeholder="Paid & unpaid"
              options={[
                { value: "paid", label: "Paid" },
                { value: "unpaid", label: "Unpaid" },
              ]}
            />
          )}
          {type !== "work" && (
            <FilterSelect
              label="Payment method"
              value={draft.paymentMethod}
              onChange={(v) => setDraftField("paymentMethod", v)}
              placeholder="All methods"
              options={[
                { value: "over-the-counter", label: "Over-the-Counter" },
                { value: "online", label: "Online" },
              ]}
            />
          )}
          {type === "work" && (
            <FilterSelect label="Status" value={draft.status} onChange={(v) => setDraftField("status", v)} placeholder="All statuses" options={WORK_STATUS_OPTIONS} />
          )}
          {type === "work" && (
            <FilterSelect
              label="Work type"
              value={draft.kind}
              onChange={(v) => setDraftField("kind", v)}
              placeholder="All types"
              options={[
                { value: "booking", label: "Booking" },
                { value: "service", label: "Service Contract" },
              ]}
            />
          )}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">{type === "work" ? "Resident / provider / request" : type === "collections" ? "Resident / receipt / reference" : "Resident / receipt no."}</label>
            <Input value={draft.search || ""} maxLength={100} onChange={(e) => setDraftField("search", e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()} placeholder="Optional" className="h-9 border-gray-200" />
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className={cn("text-xs", rangeInvalid ? "text-rose-600" : "text-gray-500")}>
            {rangeInvalid ? "The start date must be on or before the end date." : `Period: ${formatPeriod(applied)}`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} className="h-9 gap-1.5 border-gray-200 text-gray-600">
              <RotateCcw className="size-4" /> Reset
            </Button>
            <Button onClick={generate} disabled={rangeInvalid || isFetching} className="h-9 gap-1.5 bg-gray-900 hover:bg-gray-800 text-white">
              {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              Generate Report
            </Button>
          </div>
        </div>
      </div>

      {isError ? (
        <div className="bg-white rounded-2xl border border-rose-100 p-10 text-center">
          <AlertTriangle className="size-6 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-700">{apiErrorMessage(error, "The report could not be generated.")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 border-gray-200">
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {isLoading || !reportReady
              ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[84px] rounded-xl" />)
              : stats.map((s) => (
                  <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{s.label}</p>
                    <p className={cn("text-lg sm:text-xl font-bold mt-1", TONE_CLASS[s.tone || "default"])}>{s.value}</p>
                    {s.hint && <p className="text-[11px] text-gray-400">{s.hint}</p>}
                  </div>
                ))}
          </div>

          {reportReady && report.type === "collections" && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{COLLECTION_PERIOD_LABELS[collectionPeriod]}</p>
                  <p className="text-xs text-gray-500">Verified collections by payment date. Pending and rejected payments are not counted as collected.</p>
                </div>
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-full sm:w-fit">
                  {COLLECTION_PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCollectionPeriod(p)}
                      className={cn(
                        "flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors",
                        collectionPeriod === p ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <CollectionTrendChart rows={report.series[collectionPeriod]} period={collectionPeriod} />
              {(() => {
                const cash = report.summary.cashCollected;
                const online = report.summary.onlineCollected;
                const total = cash + online;
                const pct = total ? Math.round((cash / total) * 100) : 0;
                return (
                  <div className="space-y-2">
                    <div className="h-3 rounded-full bg-sky-100 overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600">
                      <span><span className="inline-block size-2 rounded-full bg-emerald-500 mr-1.5" />Cash (over-the-counter): <strong>{formatCurrency(cash)}</strong> ({pct}%)</span>
                      <span><span className="inline-block size-2 rounded-full bg-sky-300 mr-1.5" />Online: <strong>{formatCurrency(online)}</strong> ({total ? 100 - pct : 0}%)</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {reportReady && (report.type === "documents" || report.type === "payments") && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-800 mb-3">Walk-in vs Online</p>
              {(() => {
                const walkIn = report.type === "documents" ? report.summary.walkIn : report.summary.walkInRequests;
                const online = report.type === "documents" ? report.summary.online : report.summary.onlineRequests;
                const total = walkIn + online;
                const pct = total ? Math.round((walkIn / total) * 100) : 0;
                const otc = report.summary.overTheCounterRevenue;
                const onl = report.summary.onlineRevenue;
                return (
                  <div className="space-y-2">
                    <div className="h-3 rounded-full bg-sky-100 overflow-hidden flex">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-600">
                      <span><span className="inline-block size-2 rounded-full bg-emerald-500 mr-1.5" />Walk-in requests: <strong>{walkIn}</strong> ({pct}%)</span>
                      <span><span className="inline-block size-2 rounded-full bg-sky-300 mr-1.5" />Online requests: <strong>{online}</strong> ({total ? 100 - pct : 0}%)</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500">
                      <span>Over-the-counter revenue: <strong className="text-gray-800">{formatCurrency(otc)}</strong></span>
                      <span>Online revenue: <strong className="text-gray-800">{formatCurrency(onl)}</strong></span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {reportReady && (
            <div className={cn("grid gap-4", tables.length > 2 ? "lg:grid-cols-2 2xl:grid-cols-3" : tables.length > 1 ? "lg:grid-cols-2" : "")}>
              {tables.map((t) => (
                <div key={t.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <p className="text-sm font-semibold text-gray-800 px-4 pt-4 pb-2">{t.title}</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          {t.headers.map((h, i) => (
                            <TableHead key={h} className={cn("text-[11px] font-semibold uppercase tracking-wider text-slate-500", i > 0 && "text-right")}>{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {t.rows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={t.headers.length} className="text-center text-xs text-gray-400 py-6">No data</TableCell>
                          </TableRow>
                        ) : (
                          t.rows.map((r, i) => (
                            <TableRow key={i}>
                              {r.map((v, j) => (
                                <TableCell key={j} className={cn("text-sm", j > 0 && "text-right", j === 0 && "text-gray-800")}>{v}</TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">Detailed Records</p>
                <p className="text-xs text-gray-500">
                  {reportReady ? `${rows.length} of ${report.totalRows} matching records` : "Loading..."}
                  {reportReady && report.truncated && ` · showing the first ${report.rows.length}; narrow the filters for a complete list`}
                </p>
              </div>
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  placeholder="Search within results..."
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 border-gray-200"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    {columns.map((c) => {
                      const active = sortKey === c.key;
                      const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                      return (
                        <TableHead key={c.key} className={cn("text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap", c.align === "right" && "text-right")}>
                          <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 hover:text-slate-800", active && "text-slate-800")}>
                            {c.label}
                            <Icon className="size-3" />
                          </button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || !reportReady ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {columns.map((c) => (
                          <TableCell key={c.key}><Skeleton className="h-4 w-full max-w-[110px]" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : pageRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="text-center py-14">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                          <Inbox className="size-6" />
                          <p className="text-sm font-medium">No records match the selected filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageRows.map((row, i) => (
                      <TableRow key={`${row._id}-${i}`} className="hover:bg-slate-50/60">
                        {columns.map((c) => (
                          <TableCell key={c.key} className={cn("text-sm text-gray-700 whitespace-nowrap max-w-[220px] truncate", c.align === "right" && "text-right font-medium text-gray-900")}>
                            {c.value(row)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {rows.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Showing {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, rows.length)} of {rows.length}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 border-gray-200" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="size-4" /></Button>
                  <span className="px-2">Page {current} of {pages}</span>
                  <Button variant="outline" size="sm" className="h-8 border-gray-200" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight className="size-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {exporting && reportReady && canExport && (
        <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }}>
          <ReportPrintLayout
            ref={printRef}
            report={report}
            title={typeMeta.title}
            rows={rows}
            columns={columns}
            filters={appliedLabels}
            period={formatPeriod(applied)}
            barangayName={barangay?.name || "Barangay"}
            logoUrl={barangay?.logoUrl || undefined}
            searchNote={tableSearch.trim() ? `filtered by "${tableSearch.trim()}"` : undefined}
            collectionPeriod={collectionPeriod}
          />
        </div>
      )}
    </div>
  );
}
