"use client"

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterface } from "@/app/types/documentRequest";
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
import StatusHistoryModal from "@/components/documentRequest/StatusHistoryModal";
import RequestActionsMenu from "@/components/documentRequest/RequestActionsMenu";
import {
  STATUS_CONFIG,
  DOCUMENT_NAMES,
  formatRequestDate,
} from "@/app/utils/documentRequestOptions";
import { errorAlert } from "@/app/utils/alert";
import {
  Search,
  FileText,
  CheckCircle2,
  CalendarDays,
  Inbox,
  UserRound,
  Wallet,
  Eye,
  Download,
  History,
  FileOutput,
} from "lucide-react";

export default function RequestHistoryPage() {
  const [search, setSearch] = useState("");
  const [viewDoc, setViewDoc] = useState<documentRequestInterface | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [histDoc, setHistDoc] = useState<documentRequestInterface | null>(null);
  const [histModalOpen, setHistModalOpen] = useState(false);

  // ── Fetch completed requests including archived (soft-deleted) ones ──
  const { data: documents, isLoading } = useQuery<documentRequestInterface[]>({
    queryKey: ["document-requests", "secretary", "history"],
    queryFn: async () => {
      const res = await axiosInstance.get("/document-request", {
        params: { status: "completed", includeArchived: "true" },
      });
      return res.data;
    },
  });

  // ── Filter by search ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search) return documents;
    const q = search.toLowerCase();
    return documents?.filter((doc) => {
      const docName = DOCUMENT_NAMES[doc.document] || doc.document;
      const residentName = doc.resident?.name?.toLowerCase() || "";
      const residentEmail = doc.resident?.email?.toLowerCase() || "";
      return (
        docName.toLowerCase().includes(q) ||
        residentName.includes(q) ||
        residentEmail.includes(q)
      );
    });
  }, [documents, search]);

  const completedCfg = STATUS_CONFIG.completed;

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0 shadow-sm">
            <History className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Request History
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              View all completed and archived document requests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500 bg-sky-50 rounded-xl px-4 py-2 border border-sky-100">
          <FileText className="size-4 text-sky-500" />
          <span>
            Completed: <strong className="text-sky-700">{documents?.length || 0}</strong>
          </span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          placeholder="Search by document type, resident, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
        />
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Resident</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 hidden sm:table-cell">Document Type</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 hidden md:table-cell">Date Issued</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Status</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80">Payment</TableHead>
                <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-50/80 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
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
                      <p className="text-sm font-medium">No completed requests yet</p>
                      <p className="text-xs">Completed document requests will appear here</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2 text-center text-gray-400">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                        <Search className="size-5" />
                      </div>
                      <p className="text-sm font-medium">No results match your search</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((doc) => (
                  <TableRow key={doc._id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                          <UserRound className="size-3.5 text-sky-600" />
                        </div>
                        <span className="truncate max-w-[140px]">
                          {doc.resident?.name || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-gray-400 shrink-0" />
                        {DOCUMENT_NAMES[doc.document] || doc.document}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-gray-400 shrink-0" />
                        {formatRequestDate(doc)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${completedCfg.bg} ${completedCfg.text} ${completedCfg.border} border`}>
                        <CheckCircle2 className="size-3" />
                        Completed
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
                        <button
                          onClick={() => { setViewDoc(doc); setViewModalOpen(true); }}
                          className="inline-flex h-7 items-center gap-1 px-2 rounded-lg text-xs font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Eye className="size-3" />
                          View
                        </button>
                        <RequestActionsMenu
                          actions={[
                            {
                              key: "preview",
                              label: "Preview PDF",
                              icon: Eye,
                              onClick: async () => {
                                try {
                                  const { viewDocumentPDFFromDOCX } = await import("@/app/utils/generateDocument");
                                  await viewDocumentPDFFromDOCX(doc);
                                } catch {
                                  errorAlert("Failed to preview the PDF. Please try again.");
                                }
                              },
                            },
                            {
                              key: "pdf",
                              label: "Download PDF",
                              icon: Download,
                              onClick: async () => {
                                try {
                                  const { generateDocumentPDFFromDOCX } = await import("@/app/utils/generateDocument");
                                  await generateDocumentPDFFromDOCX(doc);
                                } catch {
                                  errorAlert("Failed to generate the PDF. Please try again.");
                                }
                              },
                            },
                            {
                              key: "docx",
                              label: "Download DOCX",
                              icon: FileOutput,
                              onClick: async () => {
                                try {
                                  const { generateDocumentDOCX } = await import("@/app/utils/generateDocument");
                                  await generateDocumentDOCX(doc);
                                } catch {
                                  errorAlert("Failed to generate the DOCX. Please try again.");
                                }
                              },
                            },
                            {
                              key: "history",
                              label: "Status History",
                              icon: History,
                              onClick: () => { setHistDoc(doc); setHistModalOpen(true); },
                            },
                          ]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Modals ── */}
      <RequestDetailsModal open={viewModalOpen} onOpenChange={setViewModalOpen} document={viewDoc} />
      <StatusHistoryModal open={histModalOpen} onOpenChange={setHistModalOpen} document={histDoc} />
    </div>
  );
}