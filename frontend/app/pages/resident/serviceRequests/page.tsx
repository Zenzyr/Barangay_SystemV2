"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import axiosInstance from "@/app/utils/axios";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import {
  ListChecks,
  Inbox,
  Send,
  UserRound,
  MapPin,
  Wallet,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
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

interface ServiceRequestItem {
  _id: string;
  client: PartyInfo;
  provider: PartyInfo;
  skill: string;
  serviceType: string;
  description: string;
  preferredDate?: string;
  preferredTime?: string;
  location: string;
  budget?: number;
  notes?: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
}

const STATUS_CONFIG = {
  PENDING: { label: "Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Clock },
  ACCEPTED: { label: "Accepted", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle },
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function ServiceRequestsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"sent" | "received">("sent");

  const { data: sent, isLoading: sentLoading } = useQuery<ServiceRequestItem[]>({
    queryKey: ["service-requests", "mine"],
    queryFn: async () => (await axiosInstance.get("/service-requests/mine")).data,
  });

  const { data: received, isLoading: receivedLoading } = useQuery<ServiceRequestItem[]>({
    queryKey: ["service-requests", "received"],
    queryFn: async () => (await axiosInstance.get("/service-requests/received")).data,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => axiosInstance.patch(`/service-requests/${id}/accept`),
    onSuccess: () => {
      successAlert("Request accepted — a contract has been created");
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (err: ApiError) => {
      const message = err?.response?.data || "Failed to accept request";
      errorAlert(typeof message === "string" ? message : "Failed to accept request");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => axiosInstance.patch(`/service-requests/${id}/reject`),
    onSuccess: () => {
      successAlert("Request rejected");
      queryClient.invalidateQueries({ queryKey: ["service-requests"] });
    },
    onError: () => errorAlert("Failed to reject request"),
  });

  const handleAccept = (id: string) => {
    confirmAlert("Accept this request? A service contract will be created and your availability will switch to Busy.", "Accept", () => {
      acceptMutation.mutate(id);
    });
  };

  const handleReject = (id: string) => {
    confirmAlert("Reject this request? This cannot be undone.", "Reject", () => {
      rejectMutation.mutate(id);
    });
  };

  const list = tab === "sent" ? sent : received;
  const isLoading = tab === "sent" ? sentLoading : receivedLoading;

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0">
            <ListChecks className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              Service Requests
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Requests you&apos;ve sent, and requests you&apos;ve received as a provider</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/pages/resident/residentSkills">
            <Button variant="outline" className="h-9 text-sm border-gray-200">Browse Marketplace</Button>
          </Link>
          <Link href="/pages/resident/contracts">
            <Button variant="outline" className="h-9 text-sm border-gray-200 gap-1.5">
              <FileText className="size-4" />
              My Contracts
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("sent")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "sent" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Send className="size-3.5" /> Sent {sent && sent.length > 0 && `(${sent.length})`}
        </button>
        <button
          onClick={() => setTab("received")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "received" ? "bg-white text-sky-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Inbox className="size-3.5" /> Received {received && received.filter((r) => r.status === "PENDING").length > 0 && (
            <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              {received.filter((r) => r.status === "PENDING").length}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : !list || list.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mx-auto mb-3">
              <ListChecks className="size-5" />
            </div>
            <p className="text-sm font-medium text-gray-500">
              {tab === "sent" ? "You haven't requested any services yet" : "No service requests received yet"}
            </p>
            {tab === "sent" && (
              <Link href="/pages/resident/residentSkills">
                <Button variant="outline" size="sm" className="mt-4 border-gray-200 text-gray-600">Browse the Marketplace</Button>
              </Link>
            )}
          </div>
        ) : (
          list.map((req) => {
            const cfg = STATUS_CONFIG[req.status];
            const other = tab === "sent" ? req.provider : req.client;
            return (
              <div key={req._id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-100 flex items-center justify-center shrink-0">
                      {other?.profile ? <img src={other.profile} alt={other.name} className="w-full h-full object-cover" /> : <UserRound className="size-5 text-sky-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{req.serviceType}</p>
                      <p className="text-xs text-gray-500">
                        {tab === "sent" ? "to" : "from"} <span className="font-medium">{other?.name}</span> &middot; {req.skill}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    <cfg.icon className="size-3" />
                    {cfg.label}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-3">{req.description}</p>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><MapPin className="size-3.5 text-gray-400" />{req.location}</div>
                  {req.preferredDate && <div className="flex items-center gap-1"><CalendarDays className="size-3.5 text-gray-400" />{formatDate(req.preferredDate)} {req.preferredTime}</div>}
                  {!!req.budget && <div className="flex items-center gap-1"><Wallet className="size-3.5 text-gray-400" />₱{req.budget.toLocaleString()}</div>}
                  <div className="flex items-center gap-1"><Clock className="size-3.5 text-gray-400" />Requested {formatDate(req.createdAt)}</div>
                </div>

                {tab === "received" && req.status === "PENDING" && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(req._id)}
                      disabled={acceptMutation.isPending}
                      className="h-8 text-xs bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white"
                    >
                      {acceptMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(req._id)}
                      disabled={rejectMutation.isPending}
                      className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="size-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
