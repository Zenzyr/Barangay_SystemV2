"use client"

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
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
import EditRequestModal from "@/components/documentRequest/EditRequestModal";
import DeleteRequestModal from "@/components/documentRequest/DeleteRequestModal";
import StatusHistoryModal from "@/components/documentRequest/StatusHistoryModal";
import RequestActionsMenu, { RequestActionItem } from "@/components/documentRequest/RequestActionsMenu";
import {
  STATUS_CONFIG,
  DOCUMENT_NAMES,
  formatRequestDate,
} from "@/app/utils/documentRequestOptions";
import { confirmAlert, errorAlert } from "@/app/utils/alert";
import { StatusBadge } from "@/components/ui/shared/StatusBadge";

import { getDocumentPrice } from "@/app/utils/documents";
import { payMongoPayment } from "@/app/utils/payMongo";
import {
  Search,
  FileText,
  ClipboardList,
  CalendarDays,
  Inbox,
  PhilippinePeso,
  Wallet,
  CreditCard,
  Download,
  Eye,
  PencilLine,
  Trash2,
  History,
  Loader2,
  FileOutput,
} from "lucide-react";

export default function MyDocumentsPage() {
  const { user } = useUserStore();
  const [search, setSearch] = useState("");

  const [viewDoc, setViewDoc] = useState<documentRequestInterface | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<documentRequestInterface | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<documentRequestInterface | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [histDoc, setHistDoc] = useState<documentRequestInterface | null>(null);
  const [histModalOpen, setHistModalOpen] = useState(false);

  // ── Fetch documents for this resident ─────────────────────────
  const { data: documents, isLoading } = useQuery<documentRequestInterface[]>({
    queryKey: ["document-requests", "resident", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/document-request/resident/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  // ── Filter by search ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search) return documents;
    const q = search.toLowerCase();
    return documents?.filter((doc) => {
      const name = DOCUMENT_NAMES[doc.document] || doc.document;
      return (
        name.toLowerCase().includes(q) ||
        doc.status.toLowerCase().includes(q) ||
        (doc.documentNumber || "").toLowerCase().includes(q)
      );
    });
  }, [documents, search]);

  const handlePayment = (amountInput: string, sender: string, documentId: string) => {
    confirmAlert("you want to pay online?", "pay", async () => {
      try {
        await payMongoPayment(amountInput, sender, documentId);
      } catch {
        errorAlert("Payment could not be started. Please try again.");
      }
    });
  };

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
              My Documents
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              View the status of all your document requests
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500 bg-sky-50 rounded-xl px-4 py-2 border border-sky-100">
          <FileText className="size-4 text-sky-500" />
          <span>
            Total: <strong className="text-sky-700">{documents?.length || 0}</strong>
          </span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          placeholder="Search by document type or status..."
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
              <TableRow className="border-b border-slate-100">
                <TableHead className="!px-6 !py-4 font-semibold text-slate-500">Document</TableHead>
                <TableHead className="!px-6 !py-4 font-semibold text-slate-500 hidden sm:table-cell">Price</TableHead>
                <TableHead className="!px-6 !py-4 font-semibold text-slate-500 hidden sm:table-cell">Date</TableHead>
                <TableHead className="!px-6 !py-4 font-semibold text-slate-500">Status</TableHead>
                <TableHead className="!px-6 !py-4 font-semibold text-slate-500 hidden md:table-cell">Paid</TableHead>
                <TableHead className="!px-6 !py-4 text-right font-semibold text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>

                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
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
                        <Inbox className="size-5" />
                      </div>
                      <p className="text-sm font-medium">No document requests yet</p>
                      <p className="text-xs">Submit a document request to see it here</p>
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
                filtered?.map((doc) => {
                  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const editable = ["pending", "rejected"].includes(doc.status);

                  return (
                    <TableRow key={doc._id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className="size-7 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                            <FileText className="size-3.5 text-sky-600" />
                          </div>
                          {DOCUMENT_NAMES[doc.document] || doc.document}
                        </div>
                      </TableCell>
                      <TableCell className="text-green-600 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <PhilippinePeso className="size-3.5 text-green-400 shrink-0" />
                          {getDocumentPrice(doc.document)}
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600 hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="size-3.5 text-gray-400 shrink-0" />
                          {formatRequestDate(doc)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={doc.status} config={STATUS_CONFIG} />

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
                                disabled: !doc.isPaid,
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
                                disabled: !doc.isPaid,
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
                                disabled: !doc.isPaid,
                                onClick: async () => {
                                  try {
                                    const { generateDocumentDOCX } = await import("@/app/utils/generateDocument");
                                    await generateDocumentDOCX(doc);
                                  } catch {
                                    errorAlert("Failed to generate the DOCX. Please try again.");
                                  }
                                },
                              },
                              !doc.isPaid && {
                                key: "pay",
                                label: "Pay Online",
                                icon: CreditCard,
                                className: "text-amber-600 hover:bg-amber-50",
                                onClick: () => handlePayment(
                                  getDocumentPrice(doc.document).toString(),
                                  typeof doc.resident === "object" && doc.resident ? doc.resident._id : String(doc.resident || ""),
                                  doc._id
                                ),
                              },
                              {
                                key: "edit",
                                label: "Edit Request",
                                icon: PencilLine,
                                disabled: !editable,
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
                                label: "Delete Request",
                                icon: Trash2,
                                disabled: !editable,
                                className: "text-rose-600 hover:bg-rose-50",
                                onClick: () => { setDeleteDoc(doc); setDeleteModalOpen(true); },
                              },
                            ].filter(Boolean) as RequestActionItem[]}
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
      <RequestDetailsModal open={viewModalOpen} onOpenChange={setViewModalOpen} document={viewDoc} />
      <EditRequestModal open={editModalOpen} onOpenChange={setEditModalOpen} document={editDoc} role="resident" />
      <DeleteRequestModal open={deleteModalOpen} onOpenChange={setDeleteModalOpen} document={deleteDoc} />
      <StatusHistoryModal open={histModalOpen} onOpenChange={setHistModalOpen} document={histDoc} />
    </div>
  );
}