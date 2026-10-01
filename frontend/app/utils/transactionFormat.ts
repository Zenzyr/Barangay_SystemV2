import { PaymentMethod } from "@/app/types/transaction.type";

export const VAT_RATE = 0.12;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  "over-the-counter": "Over-the-Counter",
  online: "Online",
};

export const REQUEST_SOURCE_LABELS: Record<string, string> = {
  "walk-in": "Walk-in",
  online: "Online",
};

export function formatCurrency(amount: number | null | undefined): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(amount) || 0);
}

export function formatChannel(channel: string | null | undefined): string {
  if (!channel) return "—";
  const map: Record<string, string> = {
    cash: "Cash",
    gcash: "GCash",
    paymaya: "Maya",
    grab_pay: "GrabPay",
    card: "Card",
    paymongo: "PayMongo",
  };
  return map[channel] || channel.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatLongDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: unknown }; message?: string } | null;
  const data = e?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
    return (data as { message: string }).message;
  }
  return fallback;
}
