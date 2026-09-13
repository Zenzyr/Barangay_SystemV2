"use client"

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { businessInterface } from "@/app/types/business.type";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  Eye,
  CheckCircle2,
  XCircle,
  Search,
  Building2,
  Clock,
  Loader2,
  Store,
  MapPin,
  FileText,
  UserRound,
  ShieldCheck,
  ShieldX,
  X,
  ExternalLink,
  Package,
  Inbox,
} from "lucide-react";

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

// ─── Status config ───────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; border: string }> = {
  pending:  { label: "Pending",  icon: Clock,        bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  approved: { label: "Approved", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  rejected: { label: "Rejected", icon: XCircle,       bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
};

export default function VerifyBusinessPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBusiness, setSelectedBusiness] = useState<businessInterface | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // ── Fetch pending businesses ──────────────────────────────────
  const { data: businesses, isLoading } = useQuery<businessInterface[]>({
    queryKey: ["businesses", "pending"],
    queryFn: async () => {
      const res = await axiosInstance.get("/business", {
        params: { status: "pending" },
      });
      return res.data;
    },
  });

  // ── Approve mutation ───────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.patch(`/business/${id}/status`, {
        status: "approved",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      successAlert("Business approved successfully");
      setModalOpen(false);
    },
    onError: (err: ApiError) => {
      const message =
        err?.response?.data || err?.message || "Failed to approve";
      errorAlert(typeof message === "string" ? message : "Failed to approve");
    },
  });

  // ── Reject mutation ────────────────────────────────────────────
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await axiosInstance.patch(`/business/${id}/status`, {
        status: "rejected",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      successAlert("Business rejected");
      setModalOpen(false);
    },
    onError: (err: ApiError) => {
      const message =
        err?.response?.data || err?.message || "Failed to reject";
      errorAlert(typeof message === "string" ? message : "Failed to reject");
    },
  });

  // ── Filter by search ───────────────────────────────────────────
  const filtered = businesses?.filter(
    (b) =>
      b.businessName.toLowerCase().includes(search.toLowerCase()) ||
      b.type.toLowerCase().includes(search.toLowerCase()) ||
      (b.resident?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="size-6 text-sky-600" />
            Verify Businesses
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve or reject business registration requests
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500 bg-sky-50 rounded-xl px-4 py-2 border border-sky-100">
          <Clock className="size-4 text-sky-500" />
          <span>
            Pending:{" "}
            <strong className="text-sky-700">{businesses?.length || 0}</strong>
          </span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
        <Input
          placeholder="Search by business name, type or resident..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
        />
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/80">
              <TableHead className="font-semibold text-gray-700">Business Name</TableHead>
              <TableHead className="font-semibold text-gray-700 hidden sm:table-cell">Type</TableHead>
              <TableHead className="font-semibold text-gray-700 hidden md:table-cell">Resident</TableHead>
              <TableHead className="font-semibold text-gray-700">Status</TableHead>
              <TableHead className="font-semibold text-gray-700 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto rounded-lg" /></TableCell>
                </TableRow>
              ))
            ) : !businesses || businesses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Inbox className="size-10" />
                    <p className="text-sm font-medium">No pending businesses</p>
                    <p className="text-xs">All business registrations have been reviewed</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filtered?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Search className="size-8" />
                    <p className="text-sm font-medium">No results match your search</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered?.map((business) => {
                const statusCfg = STATUS_CONFIG[business.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;

                return (
                  <TableRow
                    key={business._id}
                    className="hover:bg-sky-50/50 transition-colors"
                  >
                    <TableCell className="font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center">
                          <Store className="size-3.5 text-sky-600" />
                        </div>
                        {business.businessName}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Package className="size-3.5 text-gray-400 shrink-0" />
                        {business.type}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-600 hidden md:table-cell max-w-[180px] truncate">
                      <div className="flex items-center gap-1.5">
                        <UserRound className="size-3.5 text-gray-400 shrink-0" />
                        {business.resident?.name || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} border`}
                      >
                        <StatusIcon className="size-3" />
                        {statusCfg.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedBusiness(business);
                          setModalOpen(true);
                        }}
                        className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                      >
                        <Eye className="size-3.5" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          VIEW DETAILS MODAL
          ════════════════════════════════════════════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl p-0 gap-0">
          <div className="p-6 pb-4 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-2xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                    <Building2 className="size-5 text-sky-600" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-semibold text-gray-900">
                      {selectedBusiness?.businessName}
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                      Business verification details
                    </DialogDescription>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </DialogHeader>
          </div>

          {selectedBusiness && (
            <div className="p-6 space-y-6">
              {/* ── Logo + Basic Info ── */}
              <div className="flex items-start gap-4">
                <div className="size-20 rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-br from-sky-100 to-emerald-100 shrink-0">
                  {selectedBusiness.logo ? (
                    <img
                      src={selectedBusiness.logo}
                      alt={selectedBusiness.businessName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="size-8 text-sky-400" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="font-semibold text-gray-900">{selectedBusiness.businessName}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                      <Package className="size-3" />
                      {selectedBusiness.type}
                    </span>
                    {(() => {
                      const sc = STATUS_CONFIG[selectedBusiness.status] || STATUS_CONFIG.pending;
                      const SI = sc.icon;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text} ${sc.border} border`}>
                          <SI className="size-3" />
                          {sc.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* ── Resident info ── */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-sky-50 to-emerald-50/50 border border-sky-100">
                <div className="size-9 rounded-full bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                  <UserRound className="size-4 text-sky-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Registered By</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {selectedBusiness.resident?.name || "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {selectedBusiness.resident?.email || ""}
                  </p>
                </div>
              </div>

              {/* ── Business Info + Address ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Business Information</p>
                  <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">
                    {selectedBusiness.businessInfo}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Address</p>
                  <div className="flex items-start gap-2 text-sm text-gray-800 bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <MapPin className="size-4 text-gray-400 shrink-0 mt-0.5" />
                    <span>{selectedBusiness.address}</span>
                  </div>
                </div>
              </div>

              {/* ── Document ── */}
              {selectedBusiness.document && (
                <div className="space-y-1">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Business Document</p>
                  <a
                    href={selectedBusiness.document}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-sky-600 bg-sky-50 rounded-lg p-3 border border-sky-100 hover:bg-sky-100 transition-colors"
                  >
                    <FileText className="size-4" />
                    <span>View Document</span>
                    <ExternalLink className="size-3 ml-auto" />
                  </a>
                </div>
              )}

              {/* ── Images Gallery ── */}
              {selectedBusiness.images && selectedBusiness.images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Business Images ({selectedBusiness.images.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedBusiness.images.map((img, idx) => (
                      <div key={idx} className="rounded-lg overflow-hidden border border-gray-200 aspect-video group cursor-pointer">
                        <img
                          src={img}
                          alt={`Business image ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onClick={() => window.open(img, "_blank")}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Approve / Reject Actions ── */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
                <Button
                  onClick={() => rejectMutation.mutate(selectedBusiness._id)}
                  disabled={isMutating}
                  variant="outline"
                  className="flex-1 h-10 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldX className="size-4" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={() => approveMutation.mutate(selectedBusiness._id)}
                  disabled={isMutating}
                  className="flex-1 h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium shadow-lg shadow-sky-200/50 hover:shadow-emerald-200/50 transition-all"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="size-4" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
