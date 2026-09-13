import axiosInstance from "./axios";
import { officialInterface, officialInput } from "@/app/types/official.type";
import { accountInterface } from "@/app/types/account.type";
import { barangaySettings } from "@/app/types/barangaySettings.type";
import { purokInterface, purokInput } from "@/app/types/purok.type";
import { auditLog } from "@/app/types/auditLog.type";

export const officialsApi = {
  getAll: async (): Promise<officialInterface[]> => {
    const res = await axiosInstance.get("/barangay/officials");
    return res.data;
  },
  create: async (data: officialInput): Promise<officialInterface> => {
    const res = await axiosInstance.post("/barangay/officials", data);
    return res.data;
  },
  update: async (id: string, data: Partial<officialInput>): Promise<officialInterface> => {
    const res = await axiosInstance.put(`/barangay/officials/${id}`, data);
    return res.data;
  },
  setStatus: async (id: string, status: "active" | "inactive"): Promise<officialInterface> => {
    const res = await axiosInstance.patch(`/barangay/officials/${id}/status`, { status });
    return res.data;
  },
  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/barangay/officials/${id}`);
  },
  uploadAsset: async (
    id: string,
    kind: "photo" | "signature",
    file: File
  ): Promise<officialInterface> => {
    const formData = new FormData();
    formData.append(kind, file);
    formData.append("kind", kind);
    const res = await axiosInstance.post(`/barangay/officials/${id}/upload/${kind}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};

export const purokApi = {
  getAll: async (): Promise<purokInterface[]> => {
    const res = await axiosInstance.get("/barangay/puroks");
    return res.data;
  },
  create: async (data: purokInput): Promise<purokInterface> => {
    const res = await axiosInstance.post("/barangay/puroks", data);
    return res.data;
  },
  update: async (id: string, data: Partial<purokInput>): Promise<purokInterface> => {
    const res = await axiosInstance.put(`/barangay/puroks/${id}`, data);
    return res.data;
  },
  setStatus: async (id: string, status: "active" | "inactive"): Promise<purokInterface> => {
    const res = await axiosInstance.patch(`/barangay/puroks/${id}/status`, { status });
    return res.data;
  },
  getResidents: async (name: string): Promise<accountInterface[]> => {
    const res = await axiosInstance.get(`/barangay/puroks/${encodeURIComponent(name)}/residents`);
    return res.data;
  },
  remove: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/barangay/puroks/${id}`);
  },
};

export const settingsApi = {
  get: async (): Promise<barangaySettings> => {
    const res = await axiosInstance.get("/barangay/settings");
    return res.data;
  },
  update: async (data: Partial<barangaySettings>): Promise<barangaySettings> => {
    const res = await axiosInstance.put("/barangay/settings", data);
    return res.data;
  },
  uploadAsset: async (kind: "logo" | "seal", file: File | null): Promise<barangaySettings> => {
    if (!file) {
      // Remove the asset by sending an empty request without a file.
      const res = await axiosInstance.post("/barangay/settings/upload/" + kind, {}, {});
      return res.data;
    }
    const formData = new FormData();
    formData.append(kind, file);
    formData.append("kind", kind);
    const res = await axiosInstance.post(`/barangay/settings/upload/${kind}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
};

export const auditApi = {
  getAll: async (): Promise<auditLog[]> => {
    const res = await axiosInstance.get("/barangay/audit");
    return res.data;
  },
};