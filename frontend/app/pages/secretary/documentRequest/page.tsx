"use client"

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import RequestDetailsModal from "@/components/documentRequest/RequestDetailsModal";
import EditRequestModal from "@/components/documentRequest/EditRequestModal";
import DeleteRequestModal from "@/components/documentRequest/DeleteRequestModal";
import StatusHistoryModal from "@/components/documentRequest/StatusHistoryModal";
import WalkInRequestModal from "@/components/documentRequest/WalkInRequestModal";
import RequestActionsMenu from "@/components/documentRequest/RequestActionsMenu";
import UpdateStatusModal from "./components/updateStatusModal";
import PaymentModal from "./components/paymentModal";
import {
  STATUS_CONFIG,
  DOCUMENT_NAMES,
  DOCUMENT_OPTIONS,
  formatRequestDate,
  formatRequestTime,
} from "@/app/utils/documentRequestOptions";
import { errorAlert } from "@/app/utils/alert";
import {
  Search,
  FileText,
  Clock,
  Loader2,
  CheckCircle2,
  FileCheck,
  ClipboardList,
  CalendarDays,
  Inbox,
  UserRound,
  Wallet,
  Receipt,
  Eye,
  Download,
  ArrowUpRight,
  PencilLine,
  Trash2,
  History,
  Store,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "processing" | "to claim" | "completed" | "rejected";
type PaymentFilter = "all" | "paid" | "unpaid";
type SourceFilter = "all" | "online" | "walk-in";
type DateFilter = "all" | "today" | "7" | "30";

export default function SecretaryDocumentRequestsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [docFilter, setDocFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<documentRequestInterface | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<documentRequestInterface | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<documentRequestInterface | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [histDoc, setHistDoc] = useState<documentRequestInterface | null>(null);
  const [histModalOpen, setHistModalOpen] = useState(false);
  const [statusDoc, setStatusDoc] = useState<documentRequestInterface | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [paymentDoc, setPaymentDoc] = useState<documentRequestInterface | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // ── Fetch all non-archived requests (active + completed + rejected) ──
  const { data: documents, isLoading } = useQuery<documentRequestInterface[]>({
    queryKey: ["document-requests", "secretary"],
    queryFn: async () => {
      const res = await axiosInstance.get("/document-request");
      return res.data;
    },
  });

  // ── Stats ─────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      total: documents?.length || 0,
      pending: documents?.filter((d) => d.status === "pending").length || 0,
      processing: documents?.filter((d) => d.status === "processing").length || 0,
      toClaim: documents?.filter((d) => d.status === "to claim").length || 0,
      completed: documents?.filter((d) => d.status === "completed").length || 0,
      rejected: documents?.filter((d) => d.status === "rejected").length || 0,
      unpaid: documents?.filter((d) => !d.isPaid).length || 0,
      paid: documents?.filter((d) => d.isPaid).length || 0,
    }),
    [documents]
  );

  // ── Clickable stat cards ──────────────────────────────────────
  const STATS_CARDS: {
    label: string;
    value: number;
    icon: React.ElementType;
    bg: string;
    text: string;
    iconBg: string;
    iconColor: string;
    filter: StatusFilter | PaymentFilter;
  }[] = [
    { label: "Active Requests", value: stats.total, icon: ClipboardList, bg: "bg-sky-50", text: "text-sky-700", iconBg: "bg-sky-100", iconColor: "text-sky-600", filter: "all" },
    { label: "Pending", value: stats.pending, icon: Clock, bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100", iconColor: "text-amber-600", filter: "pending" },
    { label: "Processing", value: stats.processing, icon: Loader2, bg: "bg-sky-50", text: "text-sky-700", iconBg: "bg-sky-100", iconColor: "text-sky-600", filter: "processing" },
    { label: "To Claim", value: stats.toClaim, icon: FileCheck, bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100", iconColor: "text-violet-600", filter: "to claim" },
    { label: "Completed", value: stats.completed, icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100", iconColor: "text-emerald-600", filter: "completed" },
    { label: "Unpaid", value: stats.unpaid, icon: Wallet, bg: "bg-rose-50", text: "text-rose-700", iconBg: "bg-rose-100", iconColor: "text-rose-600", filter: "unpaid" },
    { label: "Paid", value: stats.paid, icon: Receipt, bg: "bg-teal-50", text: "text-teal-700", iconBg: "bg-teal-100", iconColor: "text-teal-600", filter: "paid" },
  ];

  const handleCardFilter = (filter: StatusFilter | PaymentFilter) => {
    setPaymentFilter(filter === "paid" || filter === "unpaid" ? filter : "all");
    setStatusFilter((["pending", "processing", "to claim", "completed", "rejected"] as StatusFilter[]).includes(filter as StatusFilter) ? filter as StatusFilter : "all");
  };

  const isCardActive = (filter: StatusFilter | PaymentFilter) =>
    filter === statusFilter || filter === paymentFilter;

  // ── Filtering ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const list = (documents || []).filter((doc) => {
      if (statusFilter !== "all" && doc.status !== statusFilter) return false;
      if (paymentFilter === "paid" && !doc.isPaid) return false;
      if (paymentFilter === "unpaid" && doc.isPaid) return false;
      if (docFilter !== "all" && doc.document !== docFilter) return false;
      if (sourceFilter !== "all" && (doc.source || "online") !== sourceFilter) return false;

      if (dateFilter !== "all") {
        const raw = doc.requestDate || doc.dateIssued || doc.createdAt || "";
        const d = new Date(String(raw).includes("T") ? String(raw) : `${raw}T00:00:00`);
        if (isNaN(d.getTime())) return false;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (dateFilter === "today") {
          if (d.getTime() < startOfToday || d.getTime() >= startOfToday + 86400000) return false;
        } else {
          const days = Number(dateFilter);
          const cutoff = startOfToday - (days - 1) * 86400000;
          if (d.getTime() < cutoff) return false;
        }
      }

      if (search) {
        const q = search.toLowerCase();
        const docName = DOCUMENT_NAMES[doc.document] || doc.document;
        const residentName = doc.resident?.name?.toLowerCase() || "";
        if (
          !docName.toLowerCase().includes(q) &&
          !residentName.includes(q) &&
          !doc.status.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
    return list;
  }, [documents, statusFilter, paymentFilter, docFilter, sourceFilter, dateFilter, search]);

  // ── Shared action helpers ─────────────────────────────────────
  const previewPDF = async (doc: documentRequestInterface) => {
    try {
      const { viewDocumentPDFFromDOCX } = await import("@/app/utils/generateDocument");
      await viewDocumentPDFFromDOCX(doc);
    } catch {
      errorAlert("Failed to preview the PDF. Please try again.");
    }
  };
  const downloadPDF = async (doc: documentRequestInterface) => {
    try {
      const { generateDocumentPDFFromDOCX } = await import("@/app/utils/generateDocument");
      await generateDocumentPDFFromDOCX(doc);
    } catch {
      errorAlert("Failed to generate the PDF. Please try again.");
    }
  };
  const downloadDOCX = async (doc: documentRequestInterface) => {
    try {
      const { generateDocumentDOCX } = await import("@/app/utils/generateDocument");
      await generateDocumentDOCX(doc);
    } catch {
      errorAlert("Failed to generate the DOCX. Please try again.");
    }
  };

  const STATUS_PILLS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "processing", label: "Processing" },
    { key: "to claim", label: "To Claim" },
    { key: "completed", label: "Completed" },
    { key: "rejected", label: "Rejected" },
  ];

  const selectClass =
    "h-9 rounded-lg border border-gray-200 bg-white px-2.5 pr-7 text-xs text-gray-600 focus:border-sky-400 focus:ring-sky-400/20 focus:outline-none";

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0 shadow-sm">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Document Requests
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage and process resident document requests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-sm text-gray-500 bg-sky-50 rounded-xl px-4 py-2 border border-sky-100">
            <FileText className="size-4 text-sky-500" />
            <span>
              Active Requests:{" "}
              <strong className="text-sky-700">{stats.total - stats.completed}</strong>
            </span>
          </div>
          <Button
            onClick={() => setWalkInOpen(true)}
            className="h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium"
          >
            <Store className="size-4" />
            Walk-in Request
          </Button>
        </div>
      </div>

      {/* ── Clickable Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {STATS_CARDS.map((card) => {
          const Icon = card.icon;
          const active = isCardActive(card.filter);
          return (
            <button
              key={card.label}
              onClick={() => handleCardFilter(card.filter)}
              className={cn(
                `${card.bg} rounded-2xl border p-4 shadow-sm transition-all duration-200 text-left`,
                active
                  ? "border-sky-400 ring-2 ring-sky-200"
                  : "border-slate-200/80 hover:shadow-md hover:-translate-y-0.5"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={`size-9 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <Icon className={`size-4 ${card.iconColor}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold ${card.text}`}>
                    {isLoading ? "—" : card.value}
                  </p>
                  <p className={`text-[11px] font-medium ${card.text} opacity-70`}>
                    {card.label}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Status pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_PILLS.map((pill) => {
          const active = statusFilter === pill.key;
          return (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(pill.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* ── Filters + search ── */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search by document type, resident, or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={docFilter} onChange={(e) => setDocFilter(e.target.value)} className={selectClass}>
            <option value="all">All Document Types</option>
            {DOCUMENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)} className={selectClass}>
            <option value="all">All Payments</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} className={selectClass}>
            <option value="all">All Sources</option>
            <option value="online">Online</option>
            <option value="walk-in">Walk-in</option>
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as DateFilter)} className={selectClass}>
            <option value="all">Any Date</option>
            <option value="today">Today</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Resident</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 hidden sm:table-cell">Document Type</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 hidden md:table-cell">Date Requested</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Payment</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto rounded-lg" /></TableCell>
                  </TableRow>
                ))
              ) : !documents || documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center gap-2 text-center text-gray-400">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                        <Inbox className="size-6" />
                      </div>
                      <p className="text-sm font-medium">No document requests yet</p>
                      <p className="text-xs">Use the Walk-in Request button to get started</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-center text-gray-400">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                        <Search className="size-5" />
                      </div>
                      <p className="text-sm font-medium">No results match your filters</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((doc) => {
                  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const source = doc.source || "online";
                  const editLocked =
                    !["pending", "processing", "rejected"].includes(doc.status);

                  return (
                    <TableRow key={doc._id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                            <UserRound className="size-3.5 text-sky-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate max-w-[140px]">{doc.resident?.name || "Unknown"}</p>
                            <p className="flex items-center gap-1 text-[10px] text-slate-400">
                              {source === "walk-in" ? (
                                <><Store className="size-2.5" /> Walk-in</>
                              ) : (
                                <><Globe className="size-2.5" /> Online</>
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[200px]">
                            {DOCUMENT_NAMES[doc.document] || doc.document}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5 text-gray-400 shrink-0" />
                          {formatRequestDate(doc)}
                          {formatRequestTime(doc) ? ` · ${formatRequestTime(doc)}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} border`}>
                          <StatusIcon className={`size-3 ${doc.status === "processing" ? "animate-spin" : ""}`} />
                          {statusCfg.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                          doc.isPaid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          <Wallet className="size-3" />
                          {doc.isPaid ? "Paid" : "Unpaid"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setViewDoc(doc); setViewModalOpen(true); }}
                            className="h-7 text-xs text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                          >
                            <Eye className="size-3" />
                            View
                          </Button>
                          <RequestActionsMenu
                            actions={[
                              {
                                key: "preview",
                                label: "Preview PDF",
                                icon: Eye,
                                onClick: () => previewPDF(doc),
                              },
                              {
                                key: "pdf",
                                label: "Download PDF",
                                icon: Download,
                                onClick: () => downloadPDF(doc),
                              },
                              {
                                key: "docx",
                                label: "Download DOCX",
                                icon: FileText,
                                onClick: () => downloadDOCX(doc),
                              },
                              {
                                key: "status",
                                label: "Update Status",
                                icon: ArrowUpRight,
                                onClick: () => { setStatusDoc(doc); setStatusModalOpen(true); },
                              },
                              {
                                key: "payment",
                                label: doc.isPaid ? "Manage Payment" : "Mark as Paid",
                                icon: Receipt,
                                onClick: () => { setPaymentDoc(doc); setPaymentModalOpen(true); },
                              },
                              {
                                key: "edit",
                                label: "Edit Request",
                                icon: PencilLine,
                                disabled: editLocked,
                                onClick: () => { setEditDoc(doc); setEditModalOpen(true); },
                              },
                              {
                                key: "history",
                                label: "Status History",
                                icon: History,
                                onClick: () => { setHistDoc(doc); setHistModalOpen(true); },
                              },
                              {
                                key: "delete",
                                label: doc.status === "completed" ? "Archive Request" : "Delete Request",
                                icon: Trash2,
                                className: "text-rose-600 hover:bg-rose-50",
                                onClick: () => { setDeleteDoc(doc); setDeleteModalOpen(true); },
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Modals ── */}
      <WalkInRequestModal open={walkInOpen} onOpenChange={setWalkInOpen} />
      <RequestDetailsModal open={viewModalOpen} onOpenChange={setViewModalOpen} document={viewDoc} />
      <EditRequestModal open={editModalOpen} onOpenChange={setEditModalOpen} document={editDoc} role="secretary" />
      <DeleteRequestModal open={deleteModalOpen} onOpenChange={setDeleteModalOpen} document={deleteDoc} />
      <StatusHistoryModal open={histModalOpen} onOpenChange={setHistModalOpen} document={histDoc} />
      <UpdateStatusModal open={statusModalOpen} onOpenChange={setStatusModalOpen} document={statusDoc} />
      <PaymentModal open={paymentModalOpen} onOpenChange={setPaymentModalOpen} document={paymentDoc} />
    </div>
  );
}