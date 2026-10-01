import { CheckCircle2, Clock, MessageSquareText, Play, XCircle, Handshake, type LucideIcon } from "lucide-react";
import { WorkRequestKind } from "@/app/types/work.type";
import { workScheduleSettings } from "@/app/types/barangaySettings.type";

export const WORK_STATUS_CONFIG: Record<string, { label: string; icon: LucideIcon; bg: string; text: string; border: string; accent: string }> = {
  pending: { label: "Pending", icon: Clock, bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", accent: "from-amber-400 to-orange-400" },
  active: { label: "In Progress", icon: Play, bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", accent: "from-sky-400 to-blue-500" },
  accepted: { label: "Accepted", icon: Handshake, bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", accent: "from-sky-400 to-emerald-400" },
  "to review": { label: "To Review", icon: MessageSquareText, bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", accent: "from-violet-400 to-fuchsia-400" },
  completed: { label: "Completed", icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", accent: "from-emerald-400 to-teal-400" },
  rejected: { label: "Rejected", icon: XCircle, bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", accent: "from-rose-400 to-pink-400" },
};

export const WORK_STATUS_OPTIONS = Object.entries(WORK_STATUS_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }));

export const WORK_KIND_LABELS: Record<WorkRequestKind, string> = {
  booking: "Booking",
  service: "Service Contract",
};

export const OPEN_WORK_STATUSES = ["pending", "active", "accepted", "to review"];

const pad = (n: number) => String(n).padStart(2, "0");

export const toDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function formatScheduleDate(dateKey: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateKey) return "";
  const date = new Date(`${dateKey}T00:00:00`);
  if (isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-PH", options ?? { weekday: "short", year: "numeric", month: "long", day: "numeric" });
}

export function bookableDates(config: workScheduleSettings | undefined, from: Date = new Date()): string[] {
  if (!config) return [];
  const dates: string[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i <= config.bookingWindowDays; i++) {
    if (config.workingDays.includes(cursor.getDay())) dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatTime12h(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;
  const h = Number(match[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${pad(hour)}:${match[2]} ${suffix}`;
}
