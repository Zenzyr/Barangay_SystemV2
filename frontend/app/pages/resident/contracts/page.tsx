"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import AddReviewModal from "@/components/ui/addReviewModal";
import {
  FileText,
  UserRound,
  MapPin,
  Wallet,
  Clock,
  CheckCircle2,
  Loader2,
  Hourglass,
  PlayCircle,
  Star,
  Ban,
  ListChecks,
} from "lucide-react";

interface PartyInfo {
  _id: string;
  name: string;
  profile: string;
}

interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

type ContractStatus = "PENDING" | "ACTIVE" | "COMPLETION_REQUESTED" | "COMPLETED" | "CANCELLED";

interface ContractItem {
  _id: string;
  client: PartyInfo;
  provider: PartyInfo;
  skill: string;
  serviceType: string;
  description: string;
  agreedPrice?: number;
  location: string;
  status: ContractStatus;
  createdAt: string;
}

const STATUS_CONFIG: Record<ContractStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  PENDING: { label: "Pending", bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200", icon: Clock },
  ACTIVE: { label: "Active", bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", icon: PlayCircle },
  COMPLETION_REQUESTED: { label: "Awaiting Your Confirmation", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Hourglass },
  COMPLETED: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: Ban },
};

export default function ContractsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"client" | "provider">("client");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewContract, setReviewContract] = useState<ContractItem | null>(null);

  const { data: asClient, isLoading: clientLoading } = useQuery<ContractItem[]>({
    queryKey: ["contracts", "mine"],
    queryFn: async () => (await axiosInstance.get("/contracts/mine")).data,
  });

  const { data: asProvider, isLoading: providerLoading } = useQuery<ContractItem[]>({
    queryKey: ["contracts", "provider"],
    queryFn: async () => (await axiosInstance.get("/contracts/provider")).data,
  });

  const requestCompletionMutation = useMutation({
    mutationFn: async (id: string) => axiosInstance.patch(`/contracts/${id}/request-completion`),
    onSuccess: () => {
      successAlert("Completion requested — waiting for the client to confirm");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data;
      errorAlert(typeof message === "string" ? message : "Failed to request completion");
    },
  });

  const confirmCompletionMutation = useMutation({
    mutationFn: async (id: string) => axiosInstance.patch(`/contracts/${id}/confirm-completion`),
    onSuccess: () => {
      successAlert("Service marked as completed! You can now leave a review.");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data;
      errorAlert(typeof message === "string" ? message : "Failed to confirm completion");
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (review: { star: number; skill: string; message: string }) => {
      await axiosInstance.post("/reviews", { contractId: reviewContract?._id, star: review.star, message: review.message });
    },
    onSuccess: () => {
      successAlert("Review submitted — thank you!");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || "Failed to submit review";
      errorAlert(typeof message === "string" ? message : "Failed to submit review");
      throw err;
    },
  });

  const handleRequestCompletion = (id: string) => {
    confirmAlert("Mark this service as done? The client will be asked to confirm completion.", "Request Completion", () => {
      requestCompletionMutation.mutate(id);
    });
  };

  const handleConfirmCompletion = (id: string) => {
    confirmAlert("Confirm that this service was completed to your satisfaction? This unlocks leaving a review.", "Confirm Completion", () => {
      confirmCompletionMutation.mutate(id);
    });
  };

  const openReview = (contract: ContractItem) => {
    setReviewContract(contract);
    setReviewModalOpen(true);
  };

  const list = tab === "client" ? asClient : asProvider;
  const isLoading = tab === "client" ? clientLoading : providerLoading;

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0">
            <FileText className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              My Contracts
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Track active and completed services, and leave reviews once done</p>
          </div>
        </div>
        <Link href="/pages/resident/serviceRequests">
          <Button variant="outline" className="h-9 text-sm border-gray-200 gap-1.5">
            <ListChecks className="size-4" />
            Service Requests
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("client")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "client" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          As Client
        </button>
        <button
          onClick={() => setTab("provider")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "provider" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
        >
          As Provider
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : !list || list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
              <FileText className="size-5" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {tab === "client" ? "No contracts yet as a client" : "No contracts yet as a provider"}
            </p>
          </div>
        ) : (
          list.map((contract) => {
            const cfg = STATUS_CONFIG[contract.status];
            const other = tab === "client" ? contract.provider : contract.client;
            return (
              <div key={contract._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                      {other?.profile ? <img src={other.profile} alt={other.name} className="w-full h-full object-cover" /> : <UserRound className="size-5 text-sky-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{contract.serviceType}</p>
                      <p className="text-xs text-gray-500">
                        {tab === "client" ? "Provider" : "Client"}: <span className="font-medium">{other?.name}</span> &middot; {contract.skill}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    <cfg.icon className="size-3" />
                    {cfg.label}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-3">{contract.description}</p>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><MapPin className="size-3.5 text-gray-400" />{contract.location}</div>
                  {!!contract.agreedPrice && <div className="flex items-center gap-1"><Wallet className="size-3.5 text-gray-400" />₱{contract.agreedPrice.toLocaleString()}</div>}
                </div>

                {/* Provider: request completion when ACTIVE */}
                {tab === "provider" && contract.status === "ACTIVE" && (
                  <Button
                    size="sm"
                    onClick={() => handleRequestCompletion(contract._id)}
                    disabled={requestCompletionMutation.isPending}
                    className="mt-4 h-8 text-xs bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white"
                  >
                    {requestCompletionMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    Request Completion
                  </Button>
                )}

                {/* Client: confirm completion when COMPLETION_REQUESTED */}
                {tab === "client" && contract.status === "COMPLETION_REQUESTED" && (
                  <Button
                    size="sm"
                    onClick={() => handleConfirmCompletion(contract._id)}
                    disabled={confirmCompletionMutation.isPending}
                    className="mt-4 h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  >
                    {confirmCompletionMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                    Confirm Completion
                  </Button>
                )}

                {/* Client: leave review when COMPLETED */}
                {tab === "client" && contract.status === "COMPLETED" && (
                  <ReviewAction contract={contract} onReview={() => openReview(contract)} />
                )}
              </div>
            );
          })
        )}
      </div>

      {reviewContract && (
        <AddReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          residentName={reviewContract.provider.name}
          residentSkills={[{ _id: reviewContract._id, skill: reviewContract.skill, experience: 0, proficiency: "" }]}
          onAdd={async (review) => {
            await reviewMutation.mutateAsync(review);
          }}
        />
      )}
    </div>
  );
}

// ─── Review Action (checks whether a review already exists for this contract) ──
function ReviewAction({ contract, onReview }: { contract: ContractItem; onReview: () => void }) {
  const { data, isLoading } = useQuery<{ exists: boolean }>({
    queryKey: ["review-exists", contract._id],
    queryFn: async () => (await axiosInstance.get(`/reviews/contract/${contract._id}`)).data,
  });

  if (isLoading) return <Skeleton className="h-8 w-32 mt-4 rounded-lg" />;

  if (data?.exists) {
    return (
      <div className="flex items-center gap-1.5 mt-4 text-xs text-emerald-600 font-medium">
        <Star className="size-3.5 fill-emerald-500 text-emerald-500" />
        You&apos;ve reviewed this service
      </div>
    );
  }

  return (
    <Button
      size="sm"
      onClick={onReview}
      className="mt-4 h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
    >
      <Star className="size-3.5" />
      Leave a Review
    </Button>
  );
}
