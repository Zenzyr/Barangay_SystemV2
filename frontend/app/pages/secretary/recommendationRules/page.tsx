"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Settings2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Power,
  PowerOff,
  HelpCircle,
  Lightbulb,
  Sparkles,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface RecommendationRule {
  _id: string;
  category: string;
  problemName: string;
  indicator: string;
  operator: string;
  threshold: number;
  programName: string;
  priorityLevel: string;
  description: string;
  status: "active" | "inactive";
}

// ─── Friendly, human-readable indicator options ───────────────────
// The `value` is the internal code the backend uses — labels are what
// non-technical staff see. All values map to existing analytics data.
interface IndicatorOption {
  value: string;
  label: string;
  shortName: string;
  suffix: string;
}

const INDICATOR_OPTIONS: IndicatorOption[] = [
  { value: "unemploymentRateHeuristic", label: "Unemployment Rate", shortName: "the unemployment rate", suffix: "%" },
  { value: "outOfSchoolRateHeuristic", label: "Out-of-School Youth Rate", shortName: "the out-of-school youth rate", suffix: "%" },
  { value: "seniorCitizenRate", label: "Senior Citizen Population Share", shortName: "the senior citizen population share", suffix: "%" },
  { value: "pwdRate", label: "PWD Population Share", shortName: "the PWD population share", suffix: "%" },
  { value: "youthRate", label: "Youth Population Share", shortName: "the youth population share", suffix: "%" },
  { value: "fourPsRate", label: "4Ps Beneficiary Share", shortName: "the 4Ps beneficiary share", suffix: "%" },
  { value: "soloParentRate", label: "Solo Parent Population Share", shortName: "the solo parent population share", suffix: "%" },
  { value: "hpnMaintenanceRate", label: "Households on HPN Maintenance", shortName: "the HPN maintenance share", suffix: "%" },
  { value: "familyPlanningRate", label: "Family Planning Uptake", shortName: "the family planning uptake share", suffix: "%" },
];

const indicatorByValue = (value: string): IndicatorOption =>
  INDICATOR_OPTIONS.find((o) => o.value === value) || INDICATOR_OPTIONS[0];

const indicatorLabel = (value: string): string => indicatorByValue(value).label;

// ─── Friendly condition (operator) phrasing ───────────────────────
const CONDITION_OPTIONS = [
  { value: ">", label: "Is more than" },
  { value: ">=", label: "Is at least" },
  { value: "<", label: "Is less than" },
  { value: "<=", label: "Is at most" },
  { value: "==", label: "Is exactly" },
];

// Natural-language verb used in the example + preview sentences.
const CONDITION_VERBS: Record<string, string> = {
  ">": "goes above",
  ">=": "reaches at least",
  "<": "drops below",
  "<=": "stays at or below",
  "==": "is exactly",
};

const conditionVerb = (value: string): string => CONDITION_VERBS[value] || "goes above";

// Plain-English phrasing used in the table's Condition column.
const OPERATOR_WORDS: Record<string, string> = {
  ">": "greater than",
  ">=": "greater than or equal to",
  "<": "less than",
  "<=": "less than or equal to",
  "==": "equal to",
};

const EMPTY_FORM: Omit<RecommendationRule, "_id"> = {
  category: "",
  problemName: "",
  indicator: "unemploymentRateHeuristic",
  operator: ">",
  threshold: 20,
  programName: "",
  priorityLevel: "MODERATE",
  description: "",
  status: "active",
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-sky-50 text-sky-700 border-sky-200",
  MODERATE: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
};

// ─── Small UI helpers ──────────────────────────────────────────────

/** "(?)" help icon with a tooltip — used on fields where extra guidance helps. */
function FieldHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex items-center justify-center rounded-full text-gray-300 hover:text-sky-500 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Label with an optional required marker and help icon. */
function FieldLabel({
  children,
  help,
  required,
}: {
  children: ReactNode;
  help?: string;
  required?: boolean;
}) {
  return (
    <Label className="flex items-center gap-1 text-sm font-medium text-gray-700">
      {children}
      {required && <span className="text-red-500">*</span>}
      {help && <FieldHelp text={help} />}
    </Label>
  );
}

/** Numbered question header that makes the form feel like a guided Q&A. */
function GuideStep({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5 pt-1">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
        {n}
      </span>
      <span className="text-sm font-semibold text-gray-800">{title}</span>
    </div>
  );
}

export default function RecommendationRulesPage() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const canManage = user?.role === "super_admin";
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: rules, isLoading } = useQuery<RecommendationRule[]>({
    queryKey: ["recommendation-rules"],
    queryFn: async () => (await axiosInstance.get("/recommendation-rules")).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => axiosInstance.delete(`/recommendation-rules/${id}`),
    onSuccess: () => {
      successAlert("Rule deleted");
      queryClient.invalidateQueries({ queryKey: ["recommendation-rules"] });
    },
    onError: () => errorAlert("Failed to delete rule"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      axiosInstance.put(`/recommendation-rules/${id}`, { status }),
    onSuccess: () => {
      successAlert("Rule status updated");
      queryClient.invalidateQueries({ queryKey: ["recommendation-rules"] });
    },
    onError: () => errorAlert("Failed to update rule status"),
  });

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (rule: RecommendationRule) => {
    setEditingId(rule._id);
    const { _id, ...rest } = rule;
    setForm(rest);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.category.trim()) {
      errorAlert("Please enter the community concern.");
      return;
    }
    if (!form.problemName.trim()) {
      errorAlert("Please enter the problem you want to monitor.");
      return;
    }
    if (!form.programName.trim()) {
      errorAlert("Please enter the recommended program.");
      return;
    }
    if (typeof form.threshold !== "number" || isNaN(form.threshold) || form.threshold < 0) {
      errorAlert("Please enter a valid value.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await axiosInstance.put(`/recommendation-rules/${editingId}`, form);
        successAlert("Rule updated");
      } else {
        await axiosInstance.post("/recommendation-rules", form);
        successAlert("Rule created");
      }
      queryClient.invalidateQueries({ queryKey: ["recommendation-rules"] });
      setModalOpen(false);
    } catch {
      errorAlert("Failed to save rule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    confirmAlert(`Delete rule "${name}"? This cannot be undone.`, "Delete", () => {
      deleteMutation.mutate(id);
    });
  };

  const selected = indicatorByValue(form.indicator);
  const verb = conditionVerb(form.operator);
  const problemPhrase = form.problemName.trim() || "the problem";
  const programPhrase = form.programName.trim() || "the program";

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shadow-sm">
              <Settings2 className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                Recommendation Rules
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Define the community problems the system should watch for and the programs it should recommend
              </p>
            </div>
          </div>
        </div>
        {canManage ? (
          <Button onClick={openAddModal} className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-lg shadow-sky-200/50 gap-1.5">
            <Plus className="size-4" />
            Create Rule
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 ring-1 ring-amber-100">
            <Settings2 className="size-3.5" />
            Read-only — only the Super Admin can configure rules
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Problem</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                  </tr>
                ))
              ) : !rules || rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="size-12 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center">
                        <Settings2 className="size-6" />
                      </div>
                      <p className="text-sm font-medium">No rules configured yet</p>
                      {canManage ? (
                        <p className="text-xs">Click &quot;Create Rule&quot; to tell the system what to watch for.</p>
                      ) : (
                        <p className="text-xs">Ask the Super Admin to configure what the system should watch for.</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{rule.category}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{rule.problemName}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <span className="font-medium text-gray-800">{indicatorLabel(rule.indicator)}</span>{" "}
                      <span className="text-gray-400">{OPERATOR_WORDS[rule.operator] || rule.operator}</span>{" "}
                      <span className="font-mono text-xs">{rule.threshold}%</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{rule.programName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${PRIORITY_STYLES[rule.priorityLevel] || ""}`}>
                        {rule.priorityLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <button
                          onClick={() => toggleMutation.mutate({ id: rule._id, status: rule.status === "active" ? "inactive" : "active" })}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                            rule.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {rule.status === "active" ? <Power className="size-3" /> : <PowerOff className="size-3" />}
                          {rule.status === "active" ? "Active" : "Inactive"}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                          rule.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}>
                          {rule.status === "active" ? <Power className="size-3" /> : <PowerOff className="size-3" />}
                          {rule.status === "active" ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(rule)}
                            className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(rule._id, rule.problemName)}
                            className="size-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center">
                <Settings2 className="size-4" />
              </div>
              {editingId ? "Edit Decision Rule" : "Create a Decision Rule"}
            </DialogTitle>
            <DialogDescription>
              Tell the system when a community problem should be flagged and what program should be recommended.
            </DialogDescription>
          </DialogHeader>

          <TooltipProvider delayDuration={150}>
            <div className="space-y-5 py-2">
              {/* 1. Community concern */}
              <GuideStep n={1} title="What community concern is this about?" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <FieldLabel required help="Choose the general area of the community problem.">
                    Community Concern
                  </FieldLabel>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Employment" />
                  <p className="text-xs text-gray-400">Examples: Employment, Health, Education, Livelihood</p>
                </div>
                <div className="space-y-1.5">
                  <FieldLabel help="How urgent is this concern for the barangay?">
                    Priority Level
                  </FieldLabel>
                  <Select value={form.priorityLevel} onValueChange={(v) => setForm({ ...form, priorityLevel: v })}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MODERATE">Moderate</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* 2. Problem to watch */}
              <GuideStep n={2} title="What problem do you want to watch?" />
              <div className="space-y-1.5">
                <FieldLabel required help="Give the problem a name that barangay staff can easily understand.">
                  Problem to Watch
                </FieldLabel>
                <Input value={form.problemName} onChange={(e) => setForm({ ...form, problemName: e.target.value })} placeholder="e.g. High Unemployment" />
              </div>

              {/* 3. Data to monitor */}
              <GuideStep n={3} title="What data should the system monitor?" />
              <div className="space-y-1.5">
                <FieldLabel required help="Choose the community data that should trigger this rule.">
                  Monitor this data
                </FieldLabel>
                <Select value={form.indicator} onValueChange={(v) => setForm({ ...form, indicator: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDICATOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">Rates are estimated from the latest resident census records.</p>
              </div>

              {/* 4. When to flag */}
              <GuideStep n={4} title="When should this problem be flagged?" />
              <div className="space-y-1.5">
                <FieldLabel required help="Choose how the value should compare, then enter the number that triggers the flag.">
                  Flag the problem when the value
                </FieldLabel>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Select value={form.operator} onValueChange={(v) => setForm({ ...form, operator: v })}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={form.threshold}
                      onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) || 0 })}
                      className="w-24 h-11 text-center text-base font-semibold border-gray-200 focus:border-sky-400 focus:ring-sky-400/20"
                    />
                    <span className="flex h-11 items-center text-sm font-medium text-gray-500">{selected.suffix}</span>
                  </div>
                </div>
              </div>

              {/* 5. Recommended program */}
              <GuideStep n={5} title="What program should be recommended?" />
              <div className="space-y-1.5">
                <FieldLabel required help="What program should the barangay suggest when this problem is flagged?">
                  Recommended Program
                </FieldLabel>
                <Input value={form.programName} onChange={(e) => setForm({ ...form, programName: e.target.value })} placeholder="e.g. Livelihood and Skills Training Program" />
              </div>

              {/* 6. Why (optional) */}
              <GuideStep n={6} title="Why should the system watch for this? (optional)" />
              <div className="space-y-1.5">
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Example: High unemployment may indicate that residents need additional livelihood or skills training opportunities."
                  rows={3}
                />
              </div>

              {/* Live example */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                  <Lightbulb className="size-3.5" />
                  Example
                </p>
                <p className="text-sm leading-relaxed text-gray-700">
                  If {selected.shortName} {verb} {form.threshold}{selected.suffix}, the system will flag{" "}
                  <span className="font-semibold text-gray-900">{problemPhrase}</span> and recommend{" "}
                  <span className="font-semibold text-gray-900">{programPhrase}</span>.
                </p>
              </div>

              {/* What will happen? */}
              <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-sky-600">
                  <Sparkles className="size-3.5" />
                  What will happen?
                </p>
                <p className="text-sm leading-relaxed text-gray-700">
                  When {selected.shortName} {verb} {form.threshold}{selected.suffix}, the system will flag:
                </p>
                <div className="mt-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
                  {form.problemName.trim() || <span className="text-gray-400">the problem</span>}
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-gray-700">and recommend:</p>
                <div className="mt-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
                  {form.programName.trim() || <span className="text-gray-400">the program</span>}
                </div>
              </div>
            </div>
          </TooltipProvider>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white shadow-lg shadow-sky-200/50">
              {saving ? <Loader2 className="size-4 animate-spin" /> : editingId ? "Save Changes" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}