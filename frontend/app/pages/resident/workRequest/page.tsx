"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { WorkRequestItem } from "@/app/types/work.type";
import { accountInterface } from "@/app/types/account.type";
import { Button } from "@/components/ui/button";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { apiErrorMessage } from "@/app/utils/transactionFormat";
import { WORK_STATUS_CONFIG } from "@/app/utils/workRequest";
import AddReviewModal from "@/components/ui/addReviewModal";
import { WorkRequestCard, WorkRequestCardSkeleton } from "@/components/workRequest/WorkRequestCard";
import {
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  FileText,
  Hammer,
  Inbox,
  Loader2,
  Plus,
  Star,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "client" | "provider";

const STATUS_FILTERS = ["all", "pending", "active", "accepted", "to review", "completed", "rejected"] as const;

function toSkillItems(skills: accountInterface["skills"] | undefined) {
  return (skills || []).map((s) => ({
    _id: (s as { _id?: string })._id || s.skill,
    skill: s.skill,
    experience: s.experience,
    proficiency: s.proficiency,
  }));
}

export default function Page() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("client");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [reviewItem, setReviewItem] = useState<WorkRequestItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: mine = [], isLoading: mineLoading } = useQuery<WorkRequestItem[]>({
    queryKey: ["work-requests", "mine", "client"],
    queryFn: async () => (await axiosInstance.get("/work/requests/mine", { params: { role: "client" } })).data,
  });

  const { data: received = [], isLoading: receivedLoading } = useQuery<WorkRequestItem[]>({
    queryKey: ["work-requests", "mine", "provider"],
    queryFn: async () => (await axiosInstance.get("/work/requests/mine", { params: { role: "provider" } })).data,
  });

  const { data: reviewProvider } = useQuery<accountInterface>({
    queryKey: ["account", reviewItem?.provider?._id],
    queryFn: async () => (await axiosInstance.get(`/account/${reviewItem?.provider?._id}`)).data,
    enabled: !!reviewItem?.provider?._id,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["work-requests"] });
    queryClient.invalidateQueries({ queryKey: ["works"] });
    queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    queryClient.invalidateQueries({ queryKey: ["work-schedule"] });
  };

  const actionMutation = useMutation({
    mutationFn: async ({ item, action }: { item: WorkRequestItem; action: "approve" | "reject" | "complete" }) => {
      if (item.kind === "service") {
        await axiosInstance.patch(`/service-requests/${item._id}/${action === "approve" ? "accept" : "reject"}`);
        return action;
      }
      const status = action === "approve" ? "active" : action === "reject" ? "rejected" : "to review";
      await axiosInstance.patch(`/work/${item._id}/status`, { status });
      return action;
    },
    onMutate: ({ item }) => setBusyId(item._id),
    onSuccess: (action, { item }) => {
      refresh();
      if (item.kind === "service" && action === "approve") {
        queryClient.invalidateQueries({ queryKey: ["contracts"] });
        successAlert("Request accepted — a contract has been created");
      } else {
        successAlert(action === "reject" ? "Request rejected" : action === "complete" ? "Marked as complete" : "Request approved");
      }
    },
    onError: (err: unknown) => errorAlert(apiErrorMessage(err, "Failed to update the work request")),
    onSettled: () => setBusyId(null),
  });

  const reviewMutation = useMutation({
    mutationFn: async (review: { star: number; skill: string; message: string }) => {
      await axiosInstance.post(`/account/${reviewItem?.provider?._id}/reviews`, { ...review, workId: reviewItem?._id });
    },
    onSuccess: () => {
      refresh();
      successAlert("Review submitted and work marked as completed!");
    },
    onError: (err: unknown) => errorAlert(apiErrorMessage(err, "Failed to submit review")),
  });

  const list = tab === "client" ? mine : received;
  const isLoading = tab === "client" ? mineLoading : receivedLoading;
  const filtered = useMemo(
    () => (statusFilter === "all" ? list : list.filter((i) => i.status === statusFilter)),
    [list, statusFilter],
  );
  const pendingReceived = received.filter((r) => r.status === "pending").length;

  const renderActions = (item: WorkRequestItem) => {
    const busy = busyId === item._id && actionMutation.isPending;
    if (tab === "provider" && item.status === "pending") {
      return (
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              confirmAlert(
                item.kind === "service"
                  ? "Accept this request? A service contract will be created and your availability will switch to Busy."
                  : `Approve this work request for ${item.scheduleLabel ? "the scheduled slot" : "the requested schedule"}?`,
                item.kind === "service" ? "Accept" : "Approve",
                () => actionMutation.mutate({ item, action: "approve" }),
              )
            }
            className="h-8 text-xs bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            {item.kind === "service" ? "Accept" : "Approve"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => confirmAlert("Reject this work request? The time slot will be released.", "Reject", () => actionMutation.mutate({ item, action: "reject" }))}
            className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
          >
            <XCircle className="size-3.5" />
            Reject
          </Button>
        </>
      );
    }
    if (tab === "provider" && item.kind === "booking" && item.status === "active") {
      return (
        <Button
          size="sm"
          disabled={busy}
          onClick={() => actionMutation.mutate({ item, action: "complete" })}
          className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          Mark Complete
        </Button>
      );
    }
    if (tab === "client" && item.kind === "booking" && item.status === "to review") {
      return (
        <Button
          size="sm"
          onClick={() => setReviewItem(item)}
          className="h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
        >
          <Star className="size-3.5" />
          Leave Review
        </Button>
      );
    }
    if (item.kind === "service" && item.status === "accepted") {
      return (
        <Link href="/pages/resident/contracts">
          <Button size="sm" variant="outline" className="h-8 text-xs border-gray-200 gap-1.5">
            <FileText className="size-3.5" />
            View Contract
          </Button>
        </Link>
      );
    }
    return null;
  };

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0 shadow-sm">
            <Hammer className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Work Requests</h1>
            <p className="text-sm text-gray-500 mt-0.5">Bookings and service requests, with their scheduled time slots</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/pages/resident/contracts">
            <Button variant="outline" className="h-9 text-sm border-gray-200 gap-1.5">
              <FileText className="size-4" />
              My Contracts
            </Button>
          </Link>
          <Link href="/pages/resident/residentSkills">
            <Button className="h-9 text-sm gap-1.5 bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white">
              <Plus className="size-4" />
              New Request
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-full sm:w-fit">
          {(
            [
              { key: "client", label: "My Requests", icon: CalendarCheck, count: mine.length },
              { key: "provider", label: "Received", icon: Briefcase, count: pendingReceived },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t.key ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700",
              )}
            >
              <t.icon className="size-4" />
              {t.label}
              {t.count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                    t.key === "provider" ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-600",
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                statusFilter === s ? "bg-sky-600 text-white border-sky-600" : "bg-white text-gray-600 border-gray-200 hover:border-sky-300",
              )}
            >
              {s === "all" ? "All" : WORK_STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <WorkRequestCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 sm:p-16 text-center">
          <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
            <Inbox className="size-5" />
          </div>
          <p className="text-sm font-medium text-gray-600">
            {list.length > 0
              ? "No work requests match this status"
              : tab === "client"
                ? "You haven't made any work requests yet"
                : "No one has requested work from you yet"}
          </p>
          {tab === "client" && list.length === 0 && (
            <Link href="/pages/resident/residentSkills">
              <Button variant="outline" size="sm" className="mt-4 border-gray-200 text-gray-600">
                Browse skilled residents
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <WorkRequestCard key={`${item.kind}-${item._id}`} item={item} perspective={tab} actions={renderActions(item)} />
          ))}
        </div>
      )}

      {reviewItem && (
        <AddReviewModal
          open={!!reviewItem}
          onOpenChange={(o) => !o && setReviewItem(null)}
          residentName={reviewItem.provider?.name || ""}
          residentSkills={toSkillItems(reviewProvider?.skills)}
          onAdd={async (review) => {
            await reviewMutation.mutateAsync(review);
          }}
        />
      )}
    </div>
  );
}
