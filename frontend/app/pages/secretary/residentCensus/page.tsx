"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
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

export default function ResidentCensusPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [purokFilter, setPurokFilter] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

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
        <Button onClick={openAddModal} className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-lg shadow-sky-200/50 gap-1.5">
          <Plus className="size-4" />
          Add Record
        </Button>
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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 bg-white"
          />
        </div>
        <Select value={purokFilter} onValueChange={setPurokFilter}>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Sex</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Occupation</th>
                <th className="px-4 py-3">Purok</th>
                <th className="px-4 py-3">Household</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Cellphone</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                        <Users className="size-6" />
                      </div>
                      <p className="text-sm font-medium">No records found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.sex}</td>
                    <td className="px-4 py-3 text-gray-600">{r.age}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.occupation}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3 text-gray-400" />
                        {r.purok}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.householdNumber}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {r.isSenior === "YES" && <Badge tone="amber">Senior</Badge>}
                        {r.isPWD === "YES" && <Badge tone="violet">PWD</Badge>}
                        {r.is4Ps === "YES" && <Badge tone="emerald">4Ps</Badge>}
                        {r.soloParent === "YES" && <Badge tone="sky">Solo Parent</Badge>}
                        {r.isSenior !== "YES" && r.isPWD !== "YES" && r.is4Ps !== "YES" && r.soloParent !== "YES" && (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.cellphone}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
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
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-gray-400">
            Showing {filtered.length} of {all.length} records
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
    </div>
  );
}
