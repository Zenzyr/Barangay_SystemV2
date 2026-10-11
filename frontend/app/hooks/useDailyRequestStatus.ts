import { useQuery } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import useUserStore from "@/app/store/useUserStore";
import { DailyRequestStatus } from "@/app/types/documentRequest";

export const DAILY_REQUEST_STATUS_KEY = ["document-requests", "daily-status"] as const;

export default function useDailyRequestStatus() {
  const { user } = useUserStore();

  const query = useQuery<DailyRequestStatus>({
    queryKey: [...DAILY_REQUEST_STATUS_KEY, user?._id],
    queryFn: async () => {
      const res = await axiosInstance.get("/document-request/daily-status");
      return res.data;
    },
    enabled: !!user?._id,
  });

  return query;
}
