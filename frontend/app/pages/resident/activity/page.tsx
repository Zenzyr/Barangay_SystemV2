"use client";

import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  History,
  LogIn,
  FileText,
  Star,
  Briefcase,
  Camera,
  KeyRound,
  ShieldCheck,
  Clock,
  CalendarDays,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface UserActivity {
  _id: string;
  accountId: string;
  activity: string;
  date: string;
}

// ─── Activity icon mapping ────────────────────────────────────────
function getActivityIcon(activity: string) {
  const iconMap: Record<string, { icon: React.ElementType; bg: string; iconColor: string }> = {
    login:               { icon: LogIn,       bg: "bg-sky-100",    iconColor: "text-sky-600" },
    "document request":  { icon: FileText,    bg: "bg-violet-100", iconColor: "text-violet-600" },
    review:              { icon: Star,        bg: "bg-amber-100",  iconColor: "text-amber-600" },
    skill:               { icon: Briefcase,   bg: "bg-emerald-100",iconColor: "text-emerald-600" },
    profile:             { icon: Camera,      bg: "bg-pink-100",   iconColor: "text-pink-600" },
    password:            { icon: KeyRound,    bg: "bg-red-100",    iconColor: "text-red-600" },
    status:              { icon: ShieldCheck, bg: "bg-teal-100",   iconColor: "text-teal-600" },
  };

  // Find matching key (case-insensitive partial match)
  const key = Object.keys(iconMap).find((k) =>
    activity.toLowerCase().includes(k)
  );
  return key ? iconMap[key] : { icon: Activity, bg: "bg-gray-100", iconColor: "text-gray-600" };
}

// ─── Format date ──────────────────────────────────────────────────
function formatActivityDate(dateStr: string): { date: string; time: string } {
  try {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  } catch {
    return { date: dateStr, time: "" };
  }
}

// ─── Loading Skeleton ─────────────────────────────────────────────
function ActivitySkeleton() {
  return (
    <div className="flex gap-4 p-4">
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────
export default function ActivityPage() {
  const { user } = useUserStore();

  // Fetch activities for the logged-in user
  const { data: activities, isLoading } = useQuery<UserActivity[]>({
    queryKey: ["activity", user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/account/activity/${user?._id}`);
      return res.data;
    },
    enabled: !!user?._id,
  });

  return (
    <div className="w-full min-h-dvh p-4 sm:p-6 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="size-11 rounded-xl bg-gradient-to-br from-sky-100 to-emerald-100 text-sky-600 flex items-center justify-center shrink-0">
          <History className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            My Activity
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track your recent actions and account activity
          </p>
        </div>
      </div>

      {/* ── Activity Feed ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Feed Header */}
        <div className="p-5 pb-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-sky-600" />
            <h2 className="text-sm font-semibold text-gray-800">Activity Log</h2>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {isLoading ? "..." : `${activities?.length || 0} entries`}
          </span>
        </div>

        {/* Activity List */}
        <div className="divide-y divide-gray-100">
          {isLoading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <ActivitySkeleton key={i} />
              ))}
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="text-center py-16">
              <div className="size-14 rounded-full bg-gray-50 mx-auto flex items-center justify-center mb-4">
                <Activity className="size-7 text-gray-300" />
              </div>
              <p className="text-base font-medium text-gray-500">No activity yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Your recent actions will appear here
              </p>
            </div>
          ) : (
            activities.map((entry, index) => {
              const { icon: Icon, bg, iconColor } = getActivityIcon(entry.activity);
              const { date, time } = formatActivityDate(entry.date);
              const isLatest = index === 0;

              return (
                <div
                  key={entry._id}
                  className={`flex items-start gap-4 p-4 sm:px-5 transition-colors hover:bg-sky-50/30 ${
                    isLatest ? "bg-sky-50/50" : ""
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`size-10 rounded-full ${bg} flex items-center justify-center shrink-0 mt-0.5 ring-2 ring-white`}
                  >
                    <Icon className={`size-5 ${iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {entry.activity}
                      </p>
                      {isLatest && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded-full">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {entry.date}
                      </span>
                    
                    </div>
                  </div>

                  {/* Timeline dot indicator */}
                  {index < activities.length - 1 && (
                    <div className="hidden sm:flex flex-col items-center shrink-0 relative">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Summary Footer ── */}
      {activities && activities.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-2">
          <Clock className="size-3" />
          Showing {activities.length} activity {activities.length === 1 ? "record" : "records"}
        </div>
      )}
    </div>
  );
}
