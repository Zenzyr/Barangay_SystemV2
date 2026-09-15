"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  Loader2,
  Clock,
  FileCheck,
  CheckCircle2,
  X,
  UserRound,
  FileText,
  Wallet,
  Ban,
} from "lucide-react";

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: documentRequestInterface | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string }> = {
  pending:    { label: "Pending",    icon: Clock,        bg: "bg-amber-50",   text: "text-amber-700" },
  processing: { label: "Processing", icon: Loader2,      bg: "bg-sky-50",     text: "text-sky-700" },
  "to claim": { label: "To Claim",   icon: FileCheck,    bg: "bg-violet-50",  text: "text-violet-700" },
  completed:  { label: "Completed",  icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700" },
  rejected:   { label: "Rejected",   icon: Ban,          bg: "bg-rose-50",    text: "text-rose-700" },
};

const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certificate",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  certificateOfGoodMoralCharacter: "Certificate of Good Moral Character",
  certificateOfUnemployment: "Certificate of Unemployment",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  certificateOfLowIncome: "Certificate of Low Income",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ)",
  endorsementLetter: "Endorsement Letter",
};

export default function UpdateStatusModal({ open, onOpenChange, document: doc }: Props) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      await axiosInstance.patch(`/document-request/${doc?._id}/status`, {
        status: newStatus,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-requests"] });
      successAlert("Document status updated successfully!");
      onOpenChange(false);
    },
    onError: (err: ApiError) => {
      const message =
        err?.response?.data || err?.message || "Failed to update status";
      errorAlert(typeof message === "string" ? message : "Update failed");
    },
  });

  if (!doc) return null;

  const currentCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
  const CurrentIcon = currentCfg.icon;
  const isPendingAction = statusMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md bg-white rounded-2xl p-0 gap-0">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-gray-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shadow-sm">
                  <FileText className="size-5 text-sky-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-gray-900">
                    Update Status
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-500">
                    {DOCUMENT_NAMES[doc.document] || doc.document}
                  </DialogDescription>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-5">
          {/* Current status */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-sm text-gray-600 font-medium">Current Status</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${currentCfg.bg} ${currentCfg.text} border border-transparent`}>
              <CurrentIcon className={`size-3 ${doc.status === "processing" ? "animate-spin" : ""}`} />
              {currentCfg.label}
            </span>
          </div>

          {/* Resident info */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <UserRound className="size-4 text-gray-400 shrink-0" />
            <span className="truncate">{doc.resident?.name || "Unknown"}</span>
          </div>

          {/* Payment status */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-gray-400" />
              <span className="text-sm text-gray-600 font-medium">Payment</span>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              doc.isPaid
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}>
              {doc.isPaid ? "Paid" : "Unpaid"}
            </span>
          </div>

          {/* Status change buttons */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Change Status To</p>

            {/* Processing */}
            {doc.status !== "processing" && (
              <Button
                onClick={() => statusMutation.mutate("processing")}
                disabled={isPendingAction}
                className="w-full h-9 justify-start gap-2.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 hover:text-sky-800 transition-all"
                variant="outline"
              >
                <Loader2 className="size-4" />
                Mark as Processing
              </Button>
            )}

            {/* To Claim */}
            {doc.status !== "to claim" && (
              <Button
                onClick={() => statusMutation.mutate("to claim")}
                disabled={isPendingAction}
                className="w-full h-9 justify-start gap-2.5 bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:text-violet-800 transition-all"
                variant="outline"
              >
                <FileCheck className="size-4" />
                Mark as Ready to Claim
              </Button>
            )}

            {/* Completed — only if paid */}
            {doc.status !== "completed" && (
              <Button
                onClick={() => statusMutation.mutate("completed")}
                disabled={isPendingAction || !doc.isPaid}
                className={`w-full h-9 justify-start gap-2.5 transition-all ${
                  doc.isPaid
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800"
                    : "bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed"
                }`}
                variant="outline"
              >
                {doc.isPaid ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Ban className="size-4" />
                )}
                {doc.isPaid ? "Mark as Completed" : "Complete (requires payment)"}
              </Button>
            )}

            {/* Rejected */}
            {doc.status !== "rejected" && (
              <Button
                onClick={() => statusMutation.mutate("rejected")}
                disabled={isPendingAction}
                className="w-full h-9 justify-start gap-2.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:text-rose-800 transition-all"
                variant="outline"
              >
                <Ban className="size-4" />
                Reject Request
              </Button>
            )}

            {/* Reopen — for rejected or statuses locked for editing */}
            {doc.status === "rejected" || doc.status === "to claim" || doc.status === "completed" ? (
              <Button
                onClick={() => statusMutation.mutate("pending")}
                disabled={isPendingAction}
                className="w-full h-9 justify-start gap-2.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 transition-all"
                variant="outline"
              >
                <Clock className="size-4" />
                Reopen as Pending
              </Button>
            ) : null}

            {isPendingAction && (
              <div className="flex items-center justify-center gap-2 text-sm text-sky-600 py-2">
                <Loader2 className="size-4 animate-spin" />
                Updating status...
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
