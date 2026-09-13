"use client";

import { useState, useMemo, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import axiosInstance from "@/app/utils/axios";
import { accountInterface } from "@/app/types/account.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Search, Users, UserCheck, ShieldCheck, Loader2, AlertTriangle, ScanSearch } from "lucide-react";

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
  { value: "super_admin", label: "Super Admin" },
] as const;

const ROLE_BADGES: Record<string, string> = {
  resident: "bg-sky-50 text-sky-700 ring-sky-100",
  secretary: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  super_admin: "bg-indigo-50 text-indigo-700 ring-indigo-100",
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
  { value: "super_admins", label: "Super Admins" },
  { value: "duplicates", label: "Duplicates" },
] as const;

function UsersContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "all";
  const focus = searchParams.get("focus");

  const [search, setSearch] = useState("");
  const [pendingRoles, setPendingRoles] = useState<Record<string, string>>({});
  const [mutatingId, setMutatingId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (accounts || []).filter((a) => {
      if (tab === "pending" && a.status !== "pending") return false;
      if (tab === "residents" && a.role !== "resident") return false;
      if (tab === "secretaries" && a.role !== "secretary") return false;
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

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                          {changed && (
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
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_BADGES[a.status] || "bg-slate-50 text-slate-600 ring-slate-200"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {a.status === "pending" ? (
                          <div className="flex justify-end gap-1.5">
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
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <p className="text-xs text-gray-500">
        Role changes apply immediately. Only the designated Super Admin can assign or revoke the
        Super Admin role, and the last Super Admin account cannot be demoted.
      </p>
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