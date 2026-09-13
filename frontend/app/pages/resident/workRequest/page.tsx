"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { workInterface } from "@/app/types/work.type";
import { accountInterface } from "@/app/types/account.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import AddReviewModal from "@/components/ui/addReviewModal";
import {
  Briefcase,
  UserRound,
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquareText,
  Play,
  CalendarDays,
  FileText,
  CalendarCheck,
  Hammer,
  Star,
  Loader2,
  Inbox,
} from "lucide-react";

// ─── Status config ───────────────────────────────────────────────
interface ApiError {
  response?: { data?: unknown };
  message?: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string; border: string }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
  active: {
    label: "Active",
    icon: Play,
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
  },
  "to review": {
    label: "To Review",
    icon: MessageSquareText,
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
};

type Tab = "bookings" | "requests";

// ─── Skill mapper for AddReviewModal ─────────────────────────────
function toSkillItems(
  skills: accountInterface["skills"]
): { _id: string; skill: string; experience: number; proficiency: string }[] {
  return (skills || []).map((s) => ({
    _id: (s as { _id?: string })._id || s.skill,
    skill: s.skill,
    experience: s.experience,
    proficiency: s.proficiency,
  }));
}

// ─── Person Info ─────────────────────────────────────────────────
function PersonInfo({ person, label }: { person: accountInterface; label: string }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="size-10 rounded-full overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
        {person.profile ? (
          <img src={person.profile} alt={person.name} className="w-full h-full object-cover" />
        ) : (
          <UserRound className="size-5 text-sky-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
          {label}
        </p>
        <p className="text-sm font-semibold text-gray-900 truncate">{person.name}</p>
        <div className="mt-1 space-y-0.5 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Mail className="size-3 text-gray-400 shrink-0" />
            <span className="truncate">{person.email}</span>
          </div>
          {person.contact && (
            <div className="flex items-center gap-1.5">
              <Phone className="size-3 text-gray-400 shrink-0" />
              <span>{person.contact}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3 text-gray-400 shrink-0" />
            <span className="truncate">{person.address}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Work Card ───────────────────────────────────────────────────
function WorkCard({ work, actions }: { work: workInterface; actions?: React.ReactNode }) {
  const statusCfg = STATUS_CONFIG[work.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-5 space-y-4">
        {/* Status + Date */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
          >
            <StatusIcon className="size-3" />
            {statusCfg.label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <CalendarDays className="size-3" />
            {work.date}
          </span>
        </div>

        {/* Work Info */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Briefcase className="size-4 text-sky-500 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-gray-900">{work.service}</p>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="size-4 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm text-gray-600">{work.description}</p>
          </div>
        </div>

        {/* Client + Worker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
          <PersonInfo person={work.client} label="Client" />
          <PersonInfo person={work.worker} label="Worker" />
        </div>

        {actions && <div className="pt-1">{actions}</div>}
      </div>
    </div>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────
function WorkCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  const Icon = icon;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="size-16 rounded-full bg-gray-50 mx-auto flex items-center justify-center mb-4">
        <Icon className="size-8 text-gray-300" />
      </div>
      <p className="text-base font-medium text-gray-600">{title}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function Page() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  const [activeTab, setActiveTab] = useState<Tab>("bookings");
  const [reviewWork, setReviewWork] = useState<workInterface | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // My Bookings — works where the logged-in user is the client
  const { data: myBookings, isLoading: bookingsLoading } = useQuery<workInterface[]>({
    queryKey: ["works", "client", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/work/client/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  // Resident Work Requests — works where the logged-in user is the worker
  const { data: workRequests, isLoading: requestsLoading } = useQuery<workInterface[]>({
    queryKey: ["works", "worker", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/work/worker/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  // Approve / Reject / Complete
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await axiosInstance.patch(`/work/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["works"] });
      successAlert("Work status updated!");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data;
      errorAlert(typeof message === "string" ? message : "Failed to update work status");
    },
  });

  // Submit review + mark work completed
  const addReviewMutation = useMutation({
    mutationFn: async (review: { star: number; skill: string; message: string }) => {
      await axiosInstance.post(`/account/${reviewWork?.worker._id}/reviews`, {
        ...review,
        workId: reviewWork?._id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["works"] });
      successAlert("Review submitted and work marked as completed!");
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data;
      errorAlert(typeof message === "string" ? message : "Failed to submit review");
    },
  });

  const openReviewModal = (work: workInterface) => {
    setReviewWork(work);
    setReviewModalOpen(true);
  };

  const handleReject = (work: workInterface) => {
    confirmAlert("Reject this work request?", "Reject", () => {
      updateStatusMutation.mutate({ id: work._id, status: "rejected" });
    });
  };

  const tabButtonClass = (active: boolean) =>
    `inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-sm font-medium border transition-all ${
      active
        ? "bg-sky-50 border-sky-200 text-sky-700"
        : "border-gray-200 text-gray-500 hover:bg-gray-50"
    }`;

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Hammer className="size-6 text-sky-600" />
          Work Requests
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Track your bookings and manage services booked with you.
        </p>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setActiveTab("bookings")}
          className={tabButtonClass(activeTab === "bookings")}
        >
          <CalendarCheck className="size-4" />
          My Bookings
          {myBookings && myBookings.length > 0 && (
            <span className="text-[10px] bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-gray-500">
              {myBookings.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={tabButtonClass(activeTab === "requests")}
        >
          <Briefcase className="size-4" />
          Resident Work Request
          {workRequests && workRequests.length > 0 && (
            <span className="text-[10px] bg-white border border-gray-200 rounded-full px-1.5 py-0.5 text-gray-500">
              {workRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* ════════════════ MY BOOKINGS ════════════════ */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          {bookingsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <WorkCardSkeleton key={i} />
              ))}
            </div>
          ) : !myBookings || myBookings.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No bookings yet"
              subtitle="Services you book from other residents will appear here."
            />
          ) : (
            myBookings.map((work) => (
              <WorkCard
                key={work._id}
                work={work}
                actions={
                  work.status === "to review" ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-gray-500">
                        This work is ready for review. Leave a review to mark it as completed.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => openReviewModal(work)}
                        disabled={addReviewMutation.isPending}
                        className="shrink-0 h-8 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-medium shadow-sm shadow-amber-200/50"
                      >
                        <Star className="size-3.5" />
                        Leave Review
                      </Button>
                    </div>
                  ) : null
                }
              />
            ))
          )}
        </div>
      )}

      {/* ════════════════ RESIDENT WORK REQUESTS ════════════════ */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {requestsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <WorkCardSkeleton key={i} />
              ))}
            </div>
          ) : !workRequests || workRequests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No work requests yet"
              subtitle="When other residents book your services, the requests will appear here."
            />
          ) : (
            workRequests.map((work) => {
              const isPending = work.status === "pending";
              const isActive = work.status === "active";
              const isMutating = updateStatusMutation.isPending;

              return (
                <WorkCard
                  key={work._id}
                  work={work}
                  actions={
                    isPending ? (
                      <div className="flex items-center gap-3 flex-wrap">
                        <Button
                          size="sm"
                          disabled={isMutating}
                          onClick={() => updateStatusMutation.mutate({ id: work._id, status: "active" })}
                          className="shrink-0 h-8 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white text-xs font-medium shadow-sm shadow-sky-200/50"
                        >
                          {isMutating ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => handleReject(work)}
                          className="shrink-0 h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
                        >
                          <XCircle className="size-3.5" />
                          Reject
                        </Button>
                      </div>
                    ) : isActive ? (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-xs text-gray-500">
                          Mark this work as complete when you are done.
                        </p>
                        <Button
                          size="sm"
                          disabled={isMutating}
                          onClick={() => updateStatusMutation.mutate({ id: work._id, status: "to review" })}
                          className="shrink-0 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-medium shadow-sm shadow-emerald-200/50"
                        >
                          {isMutating ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3.5" />
                          )}
                          Complete
                        </Button>
                      </div>
                    ) : null
                  }
                />
              );
            })
          )}
        </div>
      )}

      {/* ── Add Review Modal ── */}
      {reviewWork && (
        <AddReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          residentName={reviewWork.worker.name}
          residentSkills={toSkillItems(reviewWork.worker.skills)}
          onAdd={async (review) => {
            await addReviewMutation.mutateAsync(review);
          }}
        />
      )}
    </div>
  );
}
