"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCheck, CreditCard, FileText, Inbox, ShieldCheck, X } from "lucide-react";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────
interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread: number;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; text: string }> = {
  document: { icon: FileText, bg: "bg-violet-100", text: "text-violet-600" },
  payment: { icon: CreditCard, bg: "bg-emerald-100", text: "text-emerald-600" },
  account: { icon: ShieldCheck, bg: "bg-teal-100", text: "text-teal-600" },
};

function timeAgo(iso: string): string {
  try {
    const date = new Date(iso);
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NotificationBell({ position = "desktop" }: { position?: "desktop" | "mobile" }) {
  const { user } = useUserStore();
  const queryClient = useQueryClient();
  const userId = user?._id;
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/notification/${userId}`);
      return res.data;
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markAll = useMutation({
    mutationFn: () => axiosInstance.patch(`/notification/${userId}/read-all`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const markOne = useMutation({
    mutationFn: (id: string) => axiosInstance.patch(`/notification/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  if (!userId) return null;

  const unread = data?.unread ?? 0;
  const items = data?.notifications ?? [];

  return (
    <div
      ref={wrapperRef}
      className={cn("relative", position === "desktop" && "hidden lg:block")}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        className="relative flex size-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-sky-600"
      >
        <BellRing className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[60] mt-2 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BellRing className="size-4 text-sky-600" />
              Notifications
              {unread > 0 && (
                <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">
                  {unread}
                </span>
              )}
            </p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-sky-600 transition-colors hover:bg-sky-50 disabled:opacity-50"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[28rem] overflow-y-auto divide-y divide-slate-50">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">Loading notifications...</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-400">
                <Inbox className="size-8" />
                <p className="text-sm font-medium">No notifications yet</p>
                <p className="text-xs">Updates on your requests and account will appear here.</p>
              </div>
            ) : (
              items.map((item) => {
                const cfg = TYPE_CONFIG[item.type] || { icon: BellRing, bg: "bg-slate-100", text: "text-slate-600" };
                const Icon = cfg.icon;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => !item.read && markOne.mutate(item._id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/70",
                      !item.read && "bg-sky-50/40"
                    )}
                  >
                    <div className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", cfg.bg)}>
                      <Icon className={cn("size-4", cfg.text)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.message}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{timeAgo(item.createdAt)}</p>
                    </div>
                    {!item.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}