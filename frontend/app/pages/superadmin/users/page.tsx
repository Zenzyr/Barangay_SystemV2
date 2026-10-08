"use client";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useState, useMemo, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { accountInterface } from "@/app/types/account.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import {
  Search,
  Users,
  UserCheck,
  ShieldCheck,
  ShieldOff,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  ScanSearch,
  Clock,
  CheckCircle2,
  XCircle,
  Gavel,
} from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";


interface ApiError {
  response?: { data?: string | { message?: string } };
}

interface DuplicateEntry {
  a: { kind: string; id: string; name: string; dob?: string };
  b: { kind: string; id: string; name: string; dob?: string };
  level: "confident" | "likely";
  reason: string;
}

const ROLE_OPTIONS = [
  { value: "resident", label: "Resident" },
  { value: "secretary", label: "Secretary" },
  { value: "treasurer", label: "Treasurer" },
  { value: "super_admin", label: "Super Admin" },
] as const;

const ROLE_BADGES: Record<string, string> = {
  resident: "bg-sky-50 text-sky-700 ring-sky-100",
  secretary: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  super_admin: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  treasurer: "bg-amber-50 text-amber-700 ring-amber-100",
};

const STATUS_BADGES: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  pending: "bg-amber-50 text-amber-700 ring-amber-100",
  rejected: "bg-rose-50 text-rose-700 ring-rose-100",
};

const TABS = [
  { value: "all", label: "All accounts" },
  { value: "pending", label: "Pending" },
  { value: "residents", label: "Residents" },
  { value: "secretaries", label: "Secretaries" },
  { value: "treasurers", label: "Treasurers" },
  { value: "super_admins", label: "Super Admins" },
  { value: "duplicates", label: "Duplicates" },
  { value: "appeals", label: "Suspension Appeals" },
] as const;

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

function UsersContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";
  const focus = searchParams.get("focus");
  const { user: currentUser } = useUserStore();

  const [search, setSearch] = useState("");
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<accountInterface | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: accounts = [], isLoading } = useQuery<accountInterface[]>({
    queryKey: ["accounts"],
    queryFn: async () => (await axiosInstance.get("/account")).data,
  });

  const reportQuery = useQuery<{ entries: DuplicateEntry[] }>({
    queryKey: ["duplicates-report"],
    queryFn: async () =>
      (await axiosInstance.get("/account/duplicates/report")).data,
    enabled: tab === "duplicates",
  });

  const appealsQuery = useQuery<Appeal[]>({
    queryKey: ["suspension-appeals"],
    queryFn: async () => (await axiosInstance.get("/suspension-appeal")).data,
    enabled: tab === "appeals",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (accounts || []).filter((a) => {
      if (tab === "pending" && a.status !== "pending") return false;
      if (tab === "residents" && a.role !== "resident") return false;
      if (tab === "secretaries" && a.role !== "secretary") return false;
      if (tab === "treasurers" && a.role !== "treasurer") return false;
      if (tab === "super_admins" && a.role !== "super_admin") return false;
      if (q && !`${a.name} ${a.email}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (a._id === focus) return -1;
      if (b._id === focus) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [accounts, tab, search, focus]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  };

  const changeStatus = async (id: string, status: "approved" | "rejected") => {
    setMutatingId(id);
    try {
      await axiosInstance.patch(`/account/${id}/status`, { status });
      successAlert(
        status === "approved"
          ? "Account approved"
          : "Account rejected"
      );
      refresh();
    } catch (err) {
      const data = (err as ApiError)?.response?.data;
      errorAlert(typeof data === "string" ? data : "Failed to update status");
    } finally {
      setMutatingId(null);
    }
  };

  const saveRole = async (id: string, role: string) => {
    setMutatingId(id);
    try {
      await axiosInstance.patch(`/account/${id}/role`, { role });
      successAlert("Role updated");
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      refresh();
    } catch (err) {
      const data = (err as ApiError)?.response?.data;
      errorAlert(typeof data === "string" ? data : "Failed to update role");
    } finally {
      setMutatingId(null);
    }
  };

  const submitSuspend = async () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    setMutatingId(suspendTarget._id);
    try {
      await axiosInstance.patch(`/account/${suspendTarget._id}/suspend`, {
        reason: suspendReason.trim(),
      });
      successAlert("Account suspended");
      setSuspendTarget(null);
      setSuspendReason("");
      refresh();
    } catch (err) {
      const data = (err as ApiError)?.response?.data;
      const message = typeof data === "string" ? data : (data as { message?: string })?.message;
      errorAlert(message || "Failed to suspend account");
    } finally {
      setMutatingId(null);
    }
  };

  const unsuspend = (id: string, name: string) => {
    confirmAlert(`Lift the suspension on "${name}"?`, "Unsuspend", async () => {
      setMutatingId(id);
      try {
        await axiosInstance.patch(`/account/${id}/unsuspend`);
        successAlert("Account unsuspended");
        refresh();
      } catch (err) {
        const data = (err as ApiError)?.response?.data;
        errorAlert(typeof data === "string" ? data : "Failed to unsuspend account");
      } finally {
        setMutatingId(null);
      }
    });
  };

  const reviewAppeal = async (
    id: string,
    status: "approved" | "rejected",
    decisionNote?: string
  ) => {
    setMutatingId(id);
    try {
      await axiosInstance.patch(`/suspension-appeal/${id}`, { status, decisionNote });
      successAlert(status === "approved" ? "Appeal approved — access restored" : "Appeal rejected");
      queryClient.invalidateQueries({ queryKey: ["suspension-appeals"] });
      refresh();
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

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-gradient-to-br from-indigo-100 to-slate-100 text-indigo-600 flex items-center justify-center shadow-sm">
            <Users className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              User Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage accounts, verification statuses, and staff roles
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <a
            key={t.value}
            href={`/pages/superadmin/users${t.value === "all" ? "" : `?tab=${t.value}`}`}
            className={cnTab(t.value === tab)}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* ── Search ── */}
      {tab !== "duplicates" && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20"
          />
        </div>
      )}

      {/* ── Table ── */}
      {tab === "duplicates" ? (
        <DuplicateReportView
          entries={reportQuery.data?.entries}
          loading={reportQuery.isLoading}
        />
      ) : tab === "appeals" ? (
        <AppealsView
          appeals={appealsQuery.data}
          loading={appealsQuery.isLoading}
          mutatingId={mutatingId}
          onReview={reviewAppeal}
        />
      ) : (
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">
            No accounts match this view.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Name</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-slate-500 hidden md:table-cell">Email</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Role</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-slate-500">Status</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-[11px] uppercase tracking-wider text-slate-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100">
                {filtered.map((a) => {
                  const pendingRole = pendingRoles[a._id] ?? a.role ?? "resident";
                  const changed = pendingRole !== (a.role ?? "resident");
                  const busy = mutatingId === a._id;
                  return (
                    <tr key={a._id} className={a._id === focus ? "bg-indigo-50/40" : ""}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {a.role === "super_admin" && (
                            <ShieldCheck className="size-4 shrink-0 text-indigo-500" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-800 truncate">{a.name}</p>
                            {a.possibleDuplicate?.status === "review" && (
                              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                                <AlertTriangle className="size-3 shrink-0" />
                                Possible duplicate — review
                              </p>
                            )}
                            <p className="text-xs text-gray-500 md:hidden truncate">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <p className="text-gray-600 truncate max-w-[220px]">{a.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {a._id === currentUser?._id ? (
                            <span className="text-xs text-gray-500">{a.role === "super_admin" ? "Super Admin" : a.role} (you)</span>
                          ) : (
                          <Select
                            value={pendingRole}
                            onValueChange={(v) =>
                              setPendingRoles((prev) => ({ ...prev, [a._id]: v }))
                            }
                            disabled={busy}
                          >
                            <SelectTrigger className="h-8 w-36 border-slate-200 bg-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          )}
                          {changed && a._id !== currentUser?._id && (
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white"
                              disabled={busy}
                              onClick={() => saveRole(a._id, pendingRole)}
                            >
                              {busy ? <Loader2 className="size-3 animate-spin" /> : <UserCheck className="size-3" />}
                              Save
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_BADGES[a.status] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                            {a.status}
                          </span>
                          {a.isSuspended && (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 bg-rose-50 text-rose-700 ring-rose-200">
                              <ShieldAlert className="size-3" />
                              Suspended
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          {a.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                className="h-8 text-xs bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                                disabled={busy}
                                onClick={() => changeStatus(a._id, "approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
                                disabled={busy}
                                onClick={() => changeStatus(a._id, "rejected")}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                          {a.role !== "super_admin" && a._id !== currentUser?._id && (
                            a.isSuspended ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                disabled={busy}
                                onClick={() => unsuspend(a._id, a.name)}
                              >
                                {busy ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                                Unsuspend
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
                                disabled={busy}
                                onClick={() => {
                                  setSuspendTarget(a);
                                  setSuspendReason("");
                                }}
                              >
                                <ShieldOff className="size-3" />
                                Suspend
                              </Button>
                            )
                          )}
                          {a.status !== "pending" && (a.role === "super_admin" || a._id === currentUser?._id) && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      )}

      <p className="text-xs text-gray-500">
        Role changes apply immediately. Only the designated Super Admin can assign or revoke the
        Super Admin role, and the last Super Admin account cannot be demoted.
      </p>

      {/* ── Suspend reason dialog ── */}
      <Dialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="size-5 text-rose-500" />
              Suspend {suspendTarget?.name}
            </DialogTitle>
            <DialogDescription>
              This immediately blocks their access except for submitting an appeal. Provide a
              reason for the record.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for suspension..."
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              disabled={!suspendReason.trim() || mutatingId === suspendTarget?._id}
              onClick={submitSuspend}
            >
              {mutatingId === suspendTarget?._id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldOff className="size-4" />
              )}
              Suspend Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Gavel className="size-4 text-indigo-500" />
        <p className="text-sm font-medium text-gray-700">Suspension appeals</p>
      </div>

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

function DuplicateReportView({
  entries,
  loading,
}: {
  entries?: DuplicateEntry[];
  loading: boolean;
}) {
  const [q, setQ] = useState("");
  const filtered = (entries || []).filter((e) =>
    `${e.a.name} ${e.b.name}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  const kindLabel = (kind: string) =>
    kind === "account" ? "Account" : "Census";

  const LEVEL_BADGE: Record<string, string> = {
    confident: "bg-rose-50 text-rose-700 ring-rose-100",
    likely: "bg-amber-50 text-amber-700 ring-amber-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <ScanSearch className="size-4 text-indigo-500" />
          Possible duplicate report
        </p>
        <Input
          placeholder="Filter by name..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 w-52 border-slate-200 text-xs"
        />
      </div>

      {loading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !filtered.length ? (
        <p className="px-4 py-10 text-center text-sm text-gray-500">
          No possible duplicates found. This report is read-only — records are
          never deleted or merged automatically.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-semibold">Person A</th>
                <th className="px-4 py-3 font-semibold">Person B</th>
                <th className="px-4 py-3 font-semibold">Confidence</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{e.a.name}</p>
                    <span className="text-xs text-gray-400">{kindLabel(e.a.kind)} record</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{e.b.name}</p>
                    <span className="text-xs text-gray-400">{kindLabel(e.b.kind)} record</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${LEVEL_BADGE[e.level]}`}>
                      {e.level === "confident" ? "Likely duplicate" : "Possible match"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[240px]">{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-gray-500">
        Read-only for review. To resolve a match, open the account and update its
        role or status manually — no automatic merging.
      </p>
    </div>
  );
}

function cnTab(active: boolean): string {
  return active
    ? "inline-flex items-center rounded-full bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100"
    : "inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-800";
}

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersContent />
    </Suspense>
  );
}