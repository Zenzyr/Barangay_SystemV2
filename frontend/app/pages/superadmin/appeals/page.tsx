"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/BackButton";
import { Gavel, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface ApiError {
  response?: { data?: string | { message?: string } };
}

interface Appeal {
  _id: string;
  accountId: string;
  reason: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  decisionNote?: string;
  createdAt: string;
  account: { _id: string; name: string; email: string; suspensionReason?: string } | null;
}

const APPEAL_STATUS_BADGES: Record<Appeal["status"], string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-100",
  under_review: "bg-sky-50 text-sky-700 ring-sky-100",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  rejected: "bg-rose-50 text-rose-700 ring-rose-100",
};

export default function Page() {
  const queryClient = useQueryClient();
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const appealsQuery = useQuery<Appeal[]>({
    queryKey: ["suspension-appeals"],
    queryFn: async () => (await axiosInstance.get("/suspension-appeal")).data,
  });

  const reviewAppeal = async (
    id: string,
    status: "approved" | "rejected",
    decisionNote?: string
  ) => {
    setMutatingId(id);
    try {
      await axiosInstance.patch(`/suspension-appeal/${id}`, { status, decisionNote });
      successAlert(
        status === "approved"
          ? "Appeal approved — access restored"
          : "Appeal rejected"
      );
      queryClient.invalidateQueries({ queryKey: ["suspension-appeals"] });
    } catch (err) {
      const data = (err as ApiError)?.response?.data;
      errorAlert(typeof data === "string" ? data : "Failed to review appeal");
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <BackButton />

      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-100 to-slate-100 text-indigo-600 flex items-center justify-center shadow-sm">
          <Gavel className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Suspension Appeals
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review appeals from suspended accounts and restore access when appropriate.
          </p>
        </div>
      </div>

      <AppealsView
        appeals={appealsQuery.data}
        loading={appealsQuery.isLoading}
        mutatingId={mutatingId}
        onReview={reviewAppeal}
      />
    </div>
  );
}

function AppealsView({
  appeals,
  loading,
  mutatingId,
  onReview,
}: {
  appeals?: Appeal[];
  loading: boolean;
  mutatingId: string | null;
  onReview: (id: string, status: "approved" | "rejected", decisionNote?: string) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : !appeals?.length ? (
        <p className="px-4 py-10 text-center text-sm text-gray-500">
          No suspension appeals have been submitted.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {appeals.map((appeal) => {
            const busy = mutatingId === appeal._id;
            const decided = appeal.status === "approved" || appeal.status === "rejected";
            return (
              <div key={appeal._id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800">{appeal.account?.name || "Unknown account"}</p>
                    <p className="text-xs text-gray-500">{appeal.account?.email}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${APPEAL_STATUS_BADGES[appeal.status]}`}>
                    {appeal.status === "approved" ? <CheckCircle2 className="size-3" /> : appeal.status === "rejected" ? <XCircle className="size-3" /> : <Clock className="size-3" />}
                    {appeal.status.replace("_", " ")}
                  </span>
                </div>
                {appeal.account?.suspensionReason && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Suspended for:</span> {appeal.account.suspensionReason}
                  </p>
                )}
                <p className="text-sm text-gray-700 bg-slate-50 rounded-lg p-3">{appeal.reason}</p>
                {appeal.decisionNote && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Decision note:</span> {appeal.decisionNote}
                  </p>
                )}
                {!decided && (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      placeholder="Optional note for the resident..."
                      value={notes[appeal._id] || ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [appeal._id]: e.target.value }))}
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
                        disabled={busy}
                        onClick={() => onReview(appeal._id, "rejected", notes[appeal._id])}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                        disabled={busy}
                        onClick={() => onReview(appeal._id, "approved", notes[appeal._id])}
                      >
                        {busy ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                        Approve & Restore Access
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
