"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { ShieldAlert, LogOut, Send, Clock, CheckCircle2, XCircle } from "lucide-react";

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

interface Appeal {
  _id: string;
  reason: string;
  status: "pending" | "under_review" | "approved" | "rejected";
  decisionNote?: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<
  Appeal["status"],
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: { label: "Pending review", className: "bg-amber-50 text-amber-700 ring-amber-200", icon: Clock },
  under_review: { label: "Under review", className: "bg-sky-50 text-sky-700 ring-sky-200", icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 ring-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-rose-50 text-rose-700 ring-rose-200", icon: XCircle },
};

export default function AccountSuspended() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser } = useUserStore();
  const [reason, setReason] = useState("");

  const { data: appeals = [] } = useQuery<Appeal[]>({
    queryKey: ["my-suspension-appeals"],
    queryFn: async () => (await axiosInstance.get("/suspension-appeal/mine")).data,
    refetchInterval: 15000,
  });

  const latestAppeal = appeals[0];

  // The only way this frontend learns a suspension was lifted: an approved
  // appeal. (A direct profile re-fetch would itself be blocked while
  // suspended, by design — see backend authenticateJWT.)
  if (latestAppeal?.status === "approved" && user?.isSuspended) {
    setUser({ ...user, isSuspended: false, suspensionReason: "" });
  }

  const submitMutation = useMutation({
    mutationFn: async (reasonText: string) =>
      (await axiosInstance.post("/suspension-appeal", { reason: reasonText })).data,
    onSuccess: () => {
      successAlert("Appeal submitted. Barangay staff will review it.");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["my-suspension-appeals"] });
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || err?.message || "Failed to submit appeal";
      errorAlert(typeof message === "string" ? message : "Failed to submit appeal");
    },
  });

  const handleLogout = () => {
    queryClient.clear();
    localStorage.clear();
    sessionStorage.clear();
    router.replace("/");
  };

  const canSubmitNewAppeal = !latestAppeal || latestAppeal.status === "rejected";

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 size-20 rounded-full bg-gradient-to-br from-rose-50 to-red-50 flex items-center justify-center shadow-lg shadow-rose-200/30 border border-rose-100">
            <ShieldAlert className="size-10 text-rose-500" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-2">
            Account Suspended
          </h1>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Your account access has been temporarily suspended by barangay staff.
          </p>
        </div>

        {user?.suspensionReason && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-rose-100 shadow-sm p-5 mb-6">
            <p className="text-sm font-medium text-gray-800 mb-1">Reason given</p>
            <p className="text-sm text-gray-600">{user.suspensionReason}</p>
          </div>
        )}

        {latestAppeal && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-800">Your latest appeal</p>
              {(() => {
                const config = STATUS_CONFIG[latestAppeal.status];
                const Icon = config.icon;
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${config.className}`}>
                    <Icon className="size-3" />
                    {config.label}
                  </span>
                );
              })()}
            </div>
            <p className="text-sm text-gray-600">{latestAppeal.reason}</p>
            {latestAppeal.decisionNote && (
              <p className="mt-2 text-xs text-gray-500">
                <span className="font-medium">Staff note:</span> {latestAppeal.decisionNote}
              </p>
            )}
          </div>
        )}

        {canSubmitNewAppeal && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-sky-100 shadow-xl p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">
              Submit an appeal
            </h2>
            <Textarea
              placeholder="Explain why your suspension should be reviewed..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="border-gray-200 focus:border-sky-400 mb-3"
            />
            <Button
              onClick={() => submitMutation.mutate(reason.trim())}
              disabled={!reason.trim() || submitMutation.isPending}
              className="w-full h-10 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white font-medium"
            >
              <Send className="size-4" />
              {submitMutation.isPending ? "Submitting..." : "Submit Appeal"}
            </Button>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
