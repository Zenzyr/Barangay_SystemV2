"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  Home,
  HeartHandshake,
  Accessibility,
  Wallet,
  UserRound,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  ClipboardList,
  Upload,
  FileSpreadsheet,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface ResidentCensusRecord {
  _id: string;
  name: string;
  sex: string;
  birthday: string;
  age: number | string;
  occupation: string;
  education: string;
  purok: string;
  householdNumber: string;
  is4Ps: string;
  soloParent: string;
  familyPlanning: string;
  isSenior: string;
  hpnMaintenance: string;
  pensioner: string;
  isPWD: string;
  cellphone: string;
  accountId?: string;
}

interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: { name: string; reason: string }[];
}

// ─── CSV helpers ──────────────────────────────────────────────────
// Parses a CSV string into rows of objects. Handles quoted fields so names
// like "Munar,Orlando Munar" stay in a single column. Uses the first row's
// headers as object keys, which are normalized to the census field names.
function normalizeHeader(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  const aliases: Record<string, string> = {
    gender: "sex",
    birthdate: "birthday",
    dob: "birthday",
    household: "householdNumber",
    householdno: "householdNumber",
    householdnumber: "householdNumber",
    p4ps: "is4Ps",
    fourps: "is4Ps",
    isp4ps: "is4Ps",
    senior: "isSenior",
    seniorcitizen: "isSenior",
    isseniorcitizen: "isSenior",
    hypertensionmaintenance: "hpnMaintenance",
    hppmaintenance: "hpnMaintenance",
    contact: "cellphone",
    contactnumber: "cellphone",
    mobile: "cellphone",
    ispwd: "isPWD",
    pwd: "isPWD",
  };
  if (aliases[h]) return aliases[h];
  switch (h) {
    case "is4ps":
    case "soloparent":
    case "familyplanning":
    case "hpnmaintenance":
    case "pensioner":
    case "cellphone":
      return h;
    default:
      return h;
  }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const parseRow = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseRow(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cells = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      const value = (cells[i] ?? "").trim();
      if (h) row[h] = value;
    });
    return row;
  });
}

const EMPTY_FORM: Omit<ResidentCensusRecord, "_id"> = {
  name: "",
  sex: "N/A",
  birthday: "N/A",
  age: "N/A",
  occupation: "N/A",
  education: "N/A",
  purok: "Purok 1",
  householdNumber: "N/A",
  is4Ps: "N/A",
  soloParent: "N/A",
  familyPlanning: "N/A",
  isSenior: "N/A",
  hpnMaintenance: "N/A",
  pensioner: "N/A",
  isPWD: "N/A",
  cellphone: "N/A",
};

function getPageItems(total: number, current: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const raw = Array.from(new Set([1, total, current - 1, current, current + 1]))
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  let prev = 0;
  for (const p of raw) {
    if (p - prev > 1) out.push("...");
    out.push(p);
    prev = p;
  }
  return out;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "amber" | "violet" | "emerald" | "sky" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ─── Linked account profile (fetched when a census record has an account) ──
interface CensusAccountProfile {
  _id: string;
  name: string;
  email: string;
  contact?: string;
  gender?: string;
  dateOfBirth?: string;
  age?: string;
  civilStatus?: string;
  voterStatus?: string;
  purok?: string;
  houseHoldNumber?: string;
  address?: string;
  profile?: string;
  idType?: string;
  status?: string;
  role?: string;
  skills?: { skill: string; experience: number; proficiency: string }[];
}

function ViewProfileModal({
  record,
  onClose,
}: {
  record: ResidentCensusRecord | null;
  onClose: () => void;
}) {
  const { data: account, isLoading: loadingAccount } = useQuery<CensusAccountProfile>({
    queryKey: ["account-profile", record?.accountId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/account/${record!.accountId}`);
      return res.data;
    },
    enabled: !!record?.accountId,
  });

  const profileRows: [label: string, value: string][] = record
    ? [
        ["Name", record.name],
        ["Sex", record.sex],
        ["Age", String(record.age)],
        ["Birthday", record.birthday],
        ["Occupation", record.occupation],
        ["Education", record.education],
        ["Purok", record.purok],
        ["Household Number", record.householdNumber],
        ["Cellphone", record.cellphone],
        ["Family Planning", record.familyPlanning],
        ["Pensioner", record.pensioner],
      ]
    : [];

  const flagRows: [label: string, value: string][] = record
    ? [
        ["4Ps Beneficiary", record.is4Ps],
        ["Solo Parent", record.soloParent],
        ["Senior Citizen", record.isSenior],
        ["HPN Maintenance", record.hpnMaintenance],
        ["PWD", record.isPWD],
      ]
    : [];

  return (
    <Dialog open={!!record} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {record && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
                  {account?.profile ? (
                    <img src={account.profile} alt="" className="size-9 rounded-xl object-cover" />
                  ) : (
                    <UserRound className="size-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate">{record.name}</p>
                  <p className="text-[11px] font-normal text-gray-400">
                    Resident Census Profile
                  </p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-5 py-2">
              {record.accountId && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
                      <UserRound className="size-3.5" /> Linked Online Account
                    </p>
                    {account?.status && (
                      <Badge tone={account.status === "approved" ? "emerald" : "amber"}>
                        {account.status}
                      </Badge>
                    )}
                  </div>
                  {loadingAccount ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-1/3" />
                    </div>
                  ) : account ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div><p className="text-xs text-gray-400">Email</p><p className="text-gray-700 truncate">{account.email}</p></div>
                      <div><p className="text-xs text-gray-400">Contact</p><p className="text-gray-700">{account.contact || "—"}</p></div>
                      <div><p className="text-xs text-gray-400">Civil Status</p><p className="text-gray-700">{account.civilStatus || "—"}</p></div>
                      <div><p className="text-xs text-gray-400">Voter Status</p><p className="text-gray-700">{account.voterStatus || "—"}</p></div>
                      {account.address && (
                        <div className="sm:col-span-2"><p className="text-xs text-gray-400">Address</p><p className="text-gray-700">{account.address}</p></div>
                      )}
                      {account.idType && (
                        <div><p className="text-xs text-gray-400">ID Type</p><p className="text-gray-700">{account.idType.replace("_", " ")}</p></div>
                      )}
                      {account.skills && account.skills.length > 0 && (
                        <div className="sm:col-span-2">
                          <p className="text-xs text-gray-400 mb-1">Service Skills</p>
                          <div className="flex flex-wrap gap-1.5">
                            {account.skills.map((s, i) => (
                              <span key={i} className="text-[11px] rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 font-medium">
                                {s.skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Linked account not found.</p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Census Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {profileRows.map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-gray-700">{value || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Flags</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  {flagRows.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <p className="text-xs text-gray-500">{label}</p>
                      {value === "YES" ? (
                        <Badge tone="emerald">YES</Badge>
                      ) : (
                        <span className="text-xs text-gray-300">{value || "—"}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ResidentCensusPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [purokFilter, setPurokFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [viewing, setViewing] = useState<ResidentCensusRecord | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const importRows = useMemo(() => {
    if (!importText) return [];
    try { return parseCsv(importText); } catch { return []; }
  }, [importText]);

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") setImportText(text);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const submitImport = async () => {
    if (!importRows.length) { errorAlert("No valid rows found in the file"); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await axiosInstance.post("/resident-census/import", { records: importRows });
      setImportResult(res.data as ImportResult);
      queryClient.invalidateQueries({ queryKey: ["resident-census"] });
      if ((res.data as ImportResult).imported > 0) {
        successAlert(`${(res.data as ImportResult).imported} records imported`);
      }
    } catch {
      errorAlert("Failed to import records");
    } finally {
      setImporting(false);
    }
  };

  // ── Fetch census data ───────────────────────────────────────────
  const { data: records, isLoading } = useQuery<ResidentCensusRecord[]>({
    queryKey: ["resident-census"],
    queryFn: async () => {
      const res = await axiosInstance.get("/resident-census");
      return res.data;
    },
  });

  const all = records || [];

  const puroks = useMemo(() => {
    const set = new Set(all.map((r) => r.purok));
    return Array.from(set).sort();
  }, [all]);

  const filtered = useMemo(() => {
    return all.filter((r) => {
      if (purokFilter !== "all" && r.purok !== purokFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q) || r.householdNumber.toLowerCase().includes(q);
      }
      return true;
    });
  }, [all, purokFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startOffset = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endOffset = Math.min(currentPage * pageSize, filtered.length);

  const stats = useMemo(() => {
    const households = new Set(all.map((r) => r.householdNumber));
    return {
      total: all.length,
      households: households.size,
      seniors: all.filter((r) => r.isSenior === "YES").length,
      pwd: all.filter((r) => r.isPWD === "YES").length,
      fourPs: all.filter((r) => r.is4Ps === "YES").length,
      soloParents: all.filter((r) => r.soloParent === "YES").length,
    };
  }, [all]);

  // ── Mutations ────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => axiosInstance.delete(`/resident-census/${id}`),
    onSuccess: () => {
      successAlert("Record deleted");
      queryClient.invalidateQueries({ queryKey: ["resident-census"] });
    },
    onError: () => errorAlert("Failed to delete record"),
  });

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (record: ResidentCensusRecord) => {
    setEditingId(record._id);
    const { _id, ...rest } = record;
    setForm(rest);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      errorAlert("Name is required");
      return;
    }
    // Age must be a number 0-120 or "N/A"; birthday must be YYYY-MM-DD or N/A.
    const ageNum = Number(form.age);
    const ageOk = form.age === "N/A" || (form.age !== "" && !isNaN(ageNum) && ageNum >= 0 && ageNum <= 120);
    if (!ageOk) {
      errorAlert("Age must be a number between 0 and 120, or N/A");
      return;
    }
    const birthday = String(form.birthday || "").trim();
    if (birthday && birthday !== "N/A") {
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(birthday) && !isNaN(new Date(birthday).getTime());
      if (!isDate) {
        errorAlert("Birthday must be in YYYY-MM-DD format or N/A");
        return;
      }
    }
    if (!form.purok.trim()) {
      errorAlert("Purok is required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await axiosInstance.put(`/resident-census/${editingId}`, form);
        successAlert("Record updated");
      } else {
        await axiosInstance.post("/resident-census", form);
        successAlert("Record added");
      }
      queryClient.invalidateQueries({ queryKey: ["resident-census"] });
      setModalOpen(false);
    } catch {
      errorAlert("Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    confirmAlert(`Delete record for "${name}"? This cannot be undone.`, "Delete", () => {
      deleteMutation.mutate(id);
    });
  };

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm">
              <ClipboardList className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Resident Census</h1>
              <p className="text-sm text-gray-500 mt-0.5">Household and demographic profiling records</p>
            </div>
          </div>
        </div>
     <div className="flex items-center justify-center gap-2">
         <Button onClick={openAddModal} className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-lg shadow-sky-200/50 gap-1.5">
          <Plus className="size-4" />
          Add Record
        </Button>
        <Button onClick={() => { setImportResult(null); setImportText(""); setImportOpen(true); }} variant="outline" className="gap-1.5">
          <Upload className="size-4" />
          Import CSV
        </Button>
     </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "Total Residents", value: stats.total, icon: Users, bg: "bg-sky-50", text: "text-sky-700", iconBg: "bg-sky-100", iconColor: "text-sky-600" },
          { label: "Households", value: stats.households, icon: Home, bg: "bg-emerald-50", text: "text-emerald-700", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
          { label: "Senior Citizens", value: stats.seniors, icon: UserRound, bg: "bg-amber-50", text: "text-amber-700", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
          { label: "PWD", value: stats.pwd, icon: Accessibility, bg: "bg-violet-50", text: "text-violet-700", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
          { label: "4Ps Beneficiaries", value: stats.fourPs, icon: Wallet, bg: "bg-rose-50", text: "text-rose-700", iconBg: "bg-rose-100", iconColor: "text-rose-600" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-slate-200/80 p-4 shadow-sm ${s.bg}`}>
            <div className={`size-8 rounded-lg flex items-center justify-center mb-2 ${s.iconBg}`}>
              <s.icon className={`size-4 ${s.iconColor}`} />
            </div>
            {isLoading ? <Skeleton className="h-7 w-10" /> : <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>}
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <Input
            placeholder="Search by name or household number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-10 h-10 bg-white"
          />
        </div>
        <Select value={purokFilter} onValueChange={(v) => { setPurokFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-48 h-10 bg-white">
            <SelectValue placeholder="Filter by purok" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Puroks</SelectItem>
            {puroks.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <TableHead className="px-4 py-3">Name</TableHead>
                <TableHead className="px-4 py-3">Sex</TableHead>
                <TableHead className="px-4 py-3">Age</TableHead>
                <TableHead className="px-4 py-3">Occupation</TableHead>
                <TableHead className="px-4 py-3">Purok</TableHead>
                <TableHead className="px-4 py-3">Household</TableHead>
                <TableHead className="px-4 py-3">Tags</TableHead>
                <TableHead className="px-4 py-3">Cellphone</TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                        <Users className="size-6" />
                      </div>
                      <p className="text-sm font-medium">No records found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map((r) => (
                  <TableRow key={r._id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.name}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">{r.sex}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600">{r.age}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.occupation}</TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3 text-gray-400" />
                        {r.purok}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.householdNumber}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {r.isSenior === "YES" && <Badge tone="amber">Senior</Badge>}
                        {r.isPWD === "YES" && <Badge tone="violet">PWD</Badge>}
                        {r.is4Ps === "YES" && <Badge tone="emerald">4Ps</Badge>}
                        {r.soloParent === "YES" && <Badge tone="sky">Solo Parent</Badge>}
                        {r.isSenior !== "YES" && r.isPWD !== "YES" && r.is4Ps !== "YES" && r.soloParent !== "YES" && (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.cellphone}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewing(r)}
                          className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="View Profile"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(r)}
                          className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r._id, r.name)}
                          className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-gray-400">
              Showing <span className="font-medium text-gray-600">{startOffset}–{endOffset}</span> of <span className="font-medium text-gray-600">{filtered.length}</span> records
            </p>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[92px] text-xs bg-white">
                  <SelectValue placeholder="Per page" />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="size-4" />
              </Button>
              {getPageItems(totalPages, currentPage).map((p, i) =>
                p === "..." ? (
                  <span key={`gap-${i}`} className="px-0.5 text-xs text-gray-400">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === currentPage ? "default" : "outline"}
                    size="sm"
                    className={`h-8 min-w-8 px-2 text-xs ${p === currentPage ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                )
              )}
              <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
                <HeartHandshake className="size-4" />
              </div>
              {editingId ? "Edit Resident Record" : "Add Resident Record"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Full Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Surname,Given Name" />
            </div>
            <div className="space-y-1.5">
              <Label>Sex</Label>
              <Select value={form.sex} onValueChange={(v) => setForm({ ...form, sex: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">M</SelectItem>
                  <SelectItem value="F">F</SelectItem>
                  <SelectItem value="N/A">N/A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Birthday</Label>
              <Input
                type="text"
                value={form.birthday}
                onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                placeholder="YYYY-MM-DD or N/A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Age</Label>
              <Input
                value={String(form.age)}
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                placeholder="e.g. 45 or N/A"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Occupation</Label>
              <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Education</Label>
              <Input value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Purok</Label>
              <Input value={form.purok} onChange={(e) => setForm({ ...form, purok: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Household Number</Label>
              <Input value={form.householdNumber} onChange={(e) => setForm({ ...form, householdNumber: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cellphone</Label>
              <Input value={form.cellphone} onChange={(e) => setForm({ ...form, cellphone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Family Planning</Label>
              <Input value={form.familyPlanning} onChange={(e) => setForm({ ...form, familyPlanning: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Pensioner Type</Label>
              <Input value={form.pensioner} onChange={(e) => setForm({ ...form, pensioner: e.target.value })} />
            </div>

            {(
              [
                ["is4Ps", "4Ps Beneficiary"],
                ["soloParent", "Solo Parent"],
                ["isSenior", "Senior Citizen"],
                ["hpnMaintenance", "HPN Maintenance"],
                ["isPWD", "PWD"],
              ] as [keyof typeof form, string][]
            ).map(([key, label]) => (
              <div className="space-y-1.5" key={key}>
                <Label>{label}</Label>
                <Select value={String(form[key])} onValueChange={(v) => setForm({ ...form, [key]: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YES">YES</SelectItem>
                    <SelectItem value="NO">NO</SelectItem>
                    <SelectItem value="N/A">N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-lg shadow-sky-200/50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : editingId ? "Save Changes" : "Add Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import CSV Dialog ── */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) { setImportText(""); setImportResult(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-amber-100 text-amber-600 flex items-center justify-center">
                <FileSpreadsheet className="size-4" />
              </div>
              Import Census Records
            </DialogTitle>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-500">
                Upload a CSV file. Required column: <span className="font-medium">name</span>. Other optional columns:
                sex, birthday, age, occupation, education, purok, householdNumber, cellphone, and yes/no flags (is4Ps, soloParent, isSenior, isPWD, etc.).
              </p>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center space-y-2 hover:border-sky-300 transition-colors bg-slate-50/50">
                <input
                  type="file"
                  accept=".csv,.tsv"
                  className="hidden"
                  ref={importFileRef}
                  onChange={handleImportFile}
                />
                <FileSpreadsheet className="size-8 text-slate-300 mx-auto" />
                {importText ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">{importRows.length} rows detected in the uploaded file</p>
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setImportText(""); setImportResult(null); }}><X className="size-3.5 mr-1" />Clear</Button>
                      <Button size="sm" onClick={submitImport} disabled={importing || importRows.length === 0} className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white">
                        {importing ? <><Loader2 className="size-3.5 mr-1 animate-spin" /> Importing...</> : <><Upload className="size-3.5 mr-1" /> Import {importRows.length} Records</>}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()}>
                    <Upload className="size-3.5 mr-1" /> Choose CSV File
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-emerald-50/60 border-emerald-200 p-4">
                <p className="text-sm text-emerald-700 font-medium">{importResult.imported} record(s) imported successfully</p>
              </div>
              {importResult.skipped.length > 0 && (
                <div className="rounded-xl border bg-amber-50/60 border-amber-200 p-4 max-h-48 overflow-y-auto space-y-1">
                  <p className="text-sm text-amber-700 font-medium mb-1">{importResult.skipped.length} row(s) skipped</p>
                  {importResult.skipped.map((s, i) => (
                    <p key={i} className="text-xs text-amber-600">
                      <span className="font-medium">{s.name || "(blank)"}</span> — {s.reason}
                    </p>
                  ))}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setImportOpen(false)}>Done</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── View Profile Modal ── */}
      <ViewProfileModal record={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
