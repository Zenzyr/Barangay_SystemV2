"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, ChevronRight } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { auditApi } from "@/app/utils/barangayApi";
import { auditLog } from "@/app/types/auditLog.type";

// ─── Human-readable helpers (presentation only — audit data is untouched) ────

const FIELD_LABELS: Record<string, string> = {
  // Barangay information
  name: "Barangay Name",
  municipality: "Municipality",
  province: "Province",
  region: "Region",
  address: "Address",
  contactNumber: "Contact Number",
  email: "Email Address",
  logoUrl: "Logo",
  sealUrl: "Seal",
  headerText: "Header Text",
  footerText: "Footer Text",
  // Document settings
  backgroundUrl: "Background",
  watermarkText: "Watermark",
  certificateNumberFormat: "Certificate Number Format",
  signatoryTitle: "Signature Title",
  signaturePositions: "Signature Positions",
  marginLeft: "Left Margin",
  marginRight: "Right Margin",
  marginTop: "Top Margin",
  marginBottom: "Bottom Margin",
  overlays: "Signature Overlays",
  // SMS settings
  enabled: "SMS Notifications",
  senderName: "Sender Name",
  provider: "Provider",
  notifyOnRequest: "Notify on Request",
  notifyOnStatus: "Notify on Status",
  notifyOnPayment: "Notify on Payment",
  // Officials
  fullName: "Name",
  position: "Position",
  status: "Status",
  photo: "Photo",
  signature: "Signature",
  signatureImage: "Signature",
};

const fieldLabel = (key: string): string => FIELD_LABELS[key] || key;

/** "John Doe (Barangay Kagawad)" → name + position. */
function parseEntityLabel(label: string): { name: string; position: string } {
  const m = String(label || "").match(/^(.*?)\s*\(([^)]+)\)$/);
  if (!m) return { name: String(label || "").trim(), position: "" };
  return { name: m[1].trim(), position: m[2].trim() };
}

/** Turns a file path/URL into a friendly display name ("/assets/logo.jpg" → "Logo"). */
function nameFromUrl(url: string): string {
  try {
    let path = url;
    if (/^https?:/i.test(url)) {
      path = decodeURIComponent(new URL(url).pathname);
    }
    const base = path.split("/").filter(Boolean).pop() || "";
    return base
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

function formatValue(value: unknown, field?: string): string {
  if (value === undefined || value === null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (typeof value === "number") return field?.startsWith("margin") ? `${value} px` : String(value);
  if (Array.isArray(value)) {
    if (!value.length) return "None";
    return value
      .map((v) => (typeof v === "string" && (/^https?:/i.test(v) || /^\//.test(v)) ? nameFromUrl(v) : String(v)))
      .join(", ");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as object);
    return keys.length ? `${keys.length} item${keys.length > 1 ? "s" : ""} configured` : "None";
  }
  const s = String(value);
  if (field === "status") return s === "active" ? "Active" : s === "inactive" ? "Inactive" : s;
  if (/^https?:/i.test(s) || /^\//.test(s)) return nameFromUrl(s);
  return s;
}

/** Compares two objects/values and returns only the fields that actually changed. */
function changedFields(
  before: unknown,
  after: unknown
): { field: string; before: unknown; after: unknown }[] {
  const b = before && typeof before === "object" && !Array.isArray(before) ? before : {};
  const a = after && typeof after === "object" && !Array.isArray(after) ? after : {};
  const keys = new Set([...Object.keys(b as object), ...Object.keys(a as object)]);
  const result: { field: string; before: unknown; after: unknown }[] = [];
  for (const key of keys) {
    const bv = (b as Record<string, unknown>)[key];
    const av = (a as Record<string, unknown>)[key];
    if (JSON.stringify(bv ?? null) !== JSON.stringify(av ?? null)) {
      result.push({ field: key, before: bv, after: av });
    }
  }
  return result;
}

const isOfficial = (log: auditLog) => log.entity === "official";

const isAccount = (log: auditLog) => log.entity === "account";

/** Readable labels for account statuses and roles. */
const humanizeValue = (value: unknown): string => {
  if (value === "approved") return "Approved";
  if (value === "rejected") return "Rejected";
  if (value === "pending") return "Pending";
  if (value === "resident") return "Resident";
  if (value === "secretary") return "Secretary";
  if (value === "super_admin") return "Super Admin";
  return statusText(value);
};

const articleFor = (s: string) => (/^[aeiou]/i.test(s) || /^SK/i.test(s) ? "an" : "a");

/** Plain-language headline such as "Updated Document Settings" or "Activated Barangay Kagawad". */
function actionTitle(log: auditLog): string {
  if (isOfficial(log)) {
    const { position } = parseEntityLabel(log.entityLabel);
    switch (log.action) {
      case "create":
        return "Added a New Official";
      case "delete":
        return "Deleted an Official";
      case "update":
        return "Updated an Official";
      case "activate":
        return `Activated ${articleFor(position)} ${position || "Official"}`;
      case "deactivate":
        return `Deactivated ${articleFor(position)} ${position || "Official"}`;
      case "replace":
        return "Replaced an Official";
      case "upload":
        return log.field === "photo"
          ? "Updated an Official's Photo"
          : log.field === "signature"
          ? "Updated an Official's Signature"
          : "Updated an Official's File";
      default:
        return "Changed an Official";
    }
  }
  if (isAccount(log)) {
    if (log.action === "verify") {
      return log.newValue === "rejected"
        ? "Rejected a User's Account"
        : log.newValue === "approved"
        ? "Verified a User's Account"
        : "Updated a User's Account Status";
    }
    if (log.action === "role") {
      return "Changed a User's Role";
    }
    return "Updated a User Account";
  }
  const label = log.entityLabel || "Settings";
  if (log.action === "remove") {
    const { name: clean } = parseEntityLabel(label);
    return `Removed ${clean || label}`;
  }
  if (log.action === "upload") {
    const { name: clean } = parseEntityLabel(label);
    return `Updated ${clean || label}`;
  }
  return `Updated ${label}`;
}

/** One-line description shown under the headline (and used by search). */
function actionSummary(log: auditLog): string {
  const { name, position } = parseEntityLabel(log.entityLabel);
  const who = name ? `${name} · ${position}`.replace(/·\s*$/, "").trim() : log.entityLabel;

  if (isAccount(log)) {
    const person = log.entityLabel || "User";
    if (log.action === "verify") {
      return `${person} was ${humanizeValue(log.newValue).toLowerCase()}`;
    }
    if (log.action === "role") {
      return `${person} role changed from ${humanizeValue(log.previousValue)} to ${humanizeValue(log.newValue)}`;
    }
    return person;
  }

  if (isOfficial(log)) {
    switch (log.action) {
      case "update": {
        const fields = changedFields(log.previousValue, log.newValue);
        return fields.length ? `Changed: ${fields.map((f) => fieldLabel(f.field)).join(", ")}` : who;
      }
      case "upload":
        return `${who}${log.field === "photo" ? " — photo updated" : log.field === "signature" ? " — signature updated" : ""}`;
      default:
        return who;
    }
  }

  if (log.action === "update") {
    const fields = changedFields(log.previousValue, log.newValue);
    return fields.length ? `Changed: ${fields.map((f) => fieldLabel(f.field)).join(", ")}` : log.entityLabel;
  }
  if (log.action === "remove") return `${log.entityLabel} removed`;
  return `${log.entityLabel} updated`;
}

interface DetailRow {
  label: string;
  before: string;
  after: string;
}

const statusText = (value: unknown): string => {
  if (value === "active") return "Active";
  if (value === "inactive") return "Inactive";
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
};

const toObj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Builds the human-readable Before/After rows shown in the details modal. */
function detailRows(log: auditLog): DetailRow[] {
  if (isOfficial(log)) {
    const { name, position } = parseEntityLabel(log.entityLabel);
    switch (log.action) {
      case "create": {
        const after = toObj(log.newValue);
        const rows: DetailRow[] = [
          { label: "Official", before: "", after: name || "—" },
          { label: "Position", before: "", after: position || "—" },
        ];
        if (after.status) rows.push({ label: "Status", before: "", after: after.status === "active" ? "Active" : "Inactive" });
        return rows;
      }
      case "update":
        return changedFields(log.previousValue, log.newValue).map((c) => ({
          label: fieldLabel(c.field),
          before: formatValue(c.before, c.field),
          after: formatValue(c.after, c.field),
        }));
      case "activate":
      case "deactivate":
        return [
          { label: "Official", before: "", after: name || "—" },
          { label: "Position", before: "", after: position || "—" },
          { label: "Status", before: statusText(log.previousValue), after: statusText(log.newValue) },
        ];
      case "replace":
        return [
          { label: "Official", before: "", after: name || "—" },
          { label: "Position", before: "", after: position || "—" },
          { label: "Status", before: "Active", after: "Inactive" },
        ];
      case "delete":
        return [
          { label: "Official", before: "", after: name || "—" },
          { label: "Position", before: "", after: position || "—" },
        ];
      case "upload": {
        const f = log.field === "photo" ? "Photo" : log.field === "signature" ? "Signature" : "File";
        return [
          { label: "Official", before: "", after: name || "—" },
          { label: "Position", before: "", after: position || "—" },
          { label: f, before: formatValue(log.previousValue, log.field), after: formatValue(log.newValue, log.field) },
        ];
      }
      default:
        return [
          { label: "Official", before: "", after: name || log.entityLabel },
          { label: "Position", before: "", after: position || "—" },
        ];
    }
  }

  if (isAccount(log)) {
    const person = log.entityLabel || "User";
    if (log.action === "verify") {
      return [
        { label: "User", before: "", after: person },
        { label: "Status", before: humanizeValue(log.previousValue), after: humanizeValue(log.newValue) },
      ];
    }
    if (log.action === "role") {
      return [
        { label: "User", before: "", after: person },
        { label: "Role", before: humanizeValue(log.previousValue), after: humanizeValue(log.newValue) },
      ];
    }
    return [{ label: "User", before: "", after: person }];
  }

  if (log.action === "update") {
    const changed = changedFields(log.previousValue, log.newValue);
    if (!changed.length) return [{ label: log.entityLabel, before: "No changes", after: "No changes" }];
    return changed.map((c) => ({
      label: fieldLabel(c.field),
      before: formatValue(c.before, c.field),
      after: formatValue(c.after, c.field),
    }));
  }
  if (log.action === "upload" || log.action === "remove") {
    const { name: clean } = parseEntityLabel(log.entityLabel);
    return [
      {
        label: clean || log.entityLabel,
        before: formatValue(log.previousValue, log.field),
        after: formatValue(log.newValue, log.field),
      },
    ];
  }
  return [];
}

function noteFor(log: auditLog): string | null {
  if (isOfficial(log) && log.action === "replace")
    return "The previous holder was deactivated when the new appointment was made for this position.";
  if (isOfficial(log) && log.action === "create") {
    const prev = toObj(log.previousValue);
    if (prev.fullName) return `The previous holder, ${String(prev.fullName)}, was deactivated when this appointment was made.`;
  }
  return null;
}

// ─── Date/time formatting (local time of the user's device) ───────
const fmtDate = (iso?: string): string =>
  iso ? new Date(iso).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "—";
const fmtTime = (iso?: string): string =>
  iso ? new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }) : "";

// ─── Filters ───────────────────────────────────────────────────────
interface ActionFilterOption {
  value: string;
  label: string;
  codes: string[] | null;
}
const ACTION_FILTERS: ActionFilterOption[] = [
  { value: "all", label: "All actions", codes: null },
  { value: "created", label: "Created", codes: ["create"] },
  { value: "updated", label: "Updated", codes: ["update"] },
  { value: "deleted", label: "Deleted", codes: ["delete"] },
  { value: "activated", label: "Activated", codes: ["activate"] },
  { value: "deactivated", label: "Deactivated", codes: ["deactivate"] },
  { value: "replaced", label: "Replaced", codes: ["replace"] },
  { value: "uploaded", label: "Uploaded / Removed", codes: ["upload", "remove"] },
];

interface DateFilterOption {
  value: string;
  label: string;
  days: number | null;
}
const DATE_FILTERS: DateFilterOption[] = [
  { value: "all", label: "All dates", days: null },
  { value: "today", label: "Today", days: 0 },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
];

export default function Page() {
  const router = useRouter();
  const { data: logs = [], isLoading } = useQuery<auditLog[]>({
    queryKey: ["audit"],
    queryFn: auditApi.getAll,
  });

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selected, setSelected] = useState<auditLog | null>(null);

  const users = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.actor));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  const isWithinDateFilter = (iso: string): boolean => {
    const days = DATE_FILTERS.find((d) => d.value === dateFilter)?.days;
    if (days === null || days === undefined) return true;
    const t = new Date().getTime();
    if (days === 0) {
      const d = new Date(iso);
      const now = new Date(t);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }
    return t - new Date(iso).getTime() <= days * 24 * 60 * 60 * 1000;
  };

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const actionCodes = ACTION_FILTERS.find((a) => a.value === actionFilter)?.codes ?? null;

    const filtered = logs.filter((log) => {
      if (actionCodes && !actionCodes.includes(log.action)) return false;
      if (userFilter !== "all" && log.actor !== userFilter) return false;
      if (!isWithinDateFilter(log.createdAt)) return false;
      if (q) {
        const { name, position } = parseEntityLabel(log.entityLabel);
        const haystack = [
          log.actor,
          actionTitle(log),
          actionSummary(log),
          log.entityLabel,
          name,
          position,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const map = new Map<string, auditLog[]>();
    for (const log of filtered) {
      const date = fmtDate(log.createdAt);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(log);
    }
    return Array.from(map.entries());
  }, [logs, search, actionFilter, userFilter, dateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const EntryRow = ({ log }: { log: auditLog }) => (
    <div className="flex items-start gap-4 px-4 py-3.5">
      <div className="w-16 shrink-0 pt-0.5 text-left text-xs tabular-nums text-slate-400">
        {fmtTime(log.createdAt)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{log.actor}</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-800">{actionTitle(log)}</p>
        {actionSummary(log) && (
          <p className="mt-0.5 truncate text-xs text-slate-500">{actionSummary(log)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setSelected(log)}
        className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
      >
        View details
        <ChevronRight className="size-3" />
      </button>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-5">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          onClick={() => router.push("/pages/secretary/barangaySettings")}
        >
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Audit Trail</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every change to officials or barangay settings is recorded for accountability.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 border-slate-200 bg-white pl-9 text-sm focus:border-slate-300 focus:ring-slate-200"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-10 w-40 border-slate-200 bg-white text-sm">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_FILTERS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="h-10 w-40 border-slate-200 bg-white text-sm">
              <SelectValue placeholder="User" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u} value={u}>
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-10 w-40 border-slate-200 bg-white text-sm">
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              {DATE_FILTERS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-800">No activity recorded yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Changes made to barangay settings and records will appear here.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-800">No matching activity found.</p>
          <p className="mt-1 text-sm text-slate-500">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {groups.map(([date, items], gi) => (
            <div key={date}>
              {gi > 0 && <div className="h-px bg-slate-100" />}
              <div className="flex items-center gap-3 px-4 pt-5 pb-1">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {date}
                </h3>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="divide-y divide-slate-100 pb-3">
                {items.map((log) => (
                  <EntryRow key={log._id} log={log} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details modal */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && <DetailsBody log={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsBody({ log }: { log: auditLog }) {
  const { name, position } = parseEntityLabel(log.entityLabel);
  const rows = detailRows(log);
  const note = noteFor(log);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{actionTitle(log)}</DialogTitle>
        <DialogDescription className="text-xs">
          {log.actor} · {fmtDate(log.createdAt)} · {fmtTime(log.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <InfoBlock label="Changed by" value={log.actor} />
          <InfoBlock label="When" value={`${fmtDate(log.createdAt)} · ${fmtTime(log.createdAt)}`} />
          {name && <InfoBlock label="Official" value={name} />}
          {position && <InfoBlock label="Position" value={position} />}
          {!isOfficial(log) && log.entityLabel && (
            <InfoBlock label="Section" value={log.entityLabel} />
          )}
        </div>

        {rows.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {isOfficial(log) ? "Details" : "What changed"}
            </p>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Field</th>
                    <th className="px-3 py-2 font-semibold">Before</th>
                    <th className="px-3 py-2 font-semibold">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.label}>
                      <td className="px-3 py-2.5 font-medium text-slate-700">{row.label}</td>
                      <td className="px-3 py-2.5 text-slate-500">{row.before || "—"}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">{row.after || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
          </div>
        )}

        <details className="group rounded-md border border-slate-100 p-3">
          <summary className="cursor-pointer select-none text-xs text-slate-400 transition-colors hover:text-slate-600">
            Technical record
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            {JSON.stringify(log, null, 2)}
          </pre>
        </details>
      </div>
    </>
  );
}

function InfoBlock({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-100 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm text-slate-800">{value}</p>
    </div>
  );
}