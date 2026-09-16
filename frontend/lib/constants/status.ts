import { Clock, Loader2, FileCheck, CheckCircle2, Ban } from "lucide-react";

export type StatusConfig = {
  label: string;
  icon?: any;
  text: string;
  bg: string;
  border?: string;
};

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending:    { label: "Pending",    icon: Clock,        bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  processing: { label: "Processing", icon: Loader2,      bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" },
  "to claim": { label: "To Claim",   icon: FileCheck,    bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200" },
  completed:  { label: "Completed",  icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  rejected:   { label: "Rejected",   icon: Ban,          bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
};

