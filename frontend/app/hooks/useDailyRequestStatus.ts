import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { DailyRequestStatus } from "@/app/types/documentRequest";

export const DAILY_REQUEST_STATUS_KEY = ["document-requests", "daily-status"] as const;

const MIN_REFRESH_DELAY_MS = 30000;

export default function useDailyRequestStatus() {
  const { user } = useUserStore();
  const queryClient = useQueryClient();

  const query = useQuery<DailyRequestStatus>({
    queryKey: [...DAILY_REQUEST_STATUS_KEY, user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get("/document-request/daily-status");
      return res.data;
    },
    enabled: !!user?._id,
  });

  const resetsAt = query.data?.resetsAt;

  useEffect(() => {
    if (!resetsAt) return;
    const delay = new Date(resetsAt).getTime() - Date.now() + 1000;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: DAILY_REQUEST_STATUS_KEY });
    }, Math.max(delay, MIN_REFRESH_DELAY_MS));
    return () => clearTimeout(timer);
  }, [resetsAt, queryClient]);

  return query;
}
