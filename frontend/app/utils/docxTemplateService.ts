import axios from "axios";
import axiosInstance from "@/app/utils/axios";
import type {
  DocxTemplate,
  DocxTemplateSummary,
  TemplateVariable,
  UpdateDocxTemplatePayload,
} from "@/app/types/docxTemplate.type";
import type { JSONContent } from "@tiptap/react";

const BASE = "/document-templates-docx";

export async function getDocxTemplates(): Promise<DocxTemplateSummary[]> {
  const res = await axiosInstance.get(BASE);
  return res.data;
}

export async function getDocxTemplate(id: string): Promise<DocxTemplate> {
  const res = await axiosInstance.get(`${BASE}/${id}`);
  return res.data;
}

export async function getTemplateVariables(): Promise<TemplateVariable[]> {
  const res = await axiosInstance.get(`${BASE}/variables`);
  return res.data;
}

export async function updateDocxTemplate(
  id: string,
  payload: UpdateDocxTemplatePayload,
): Promise<DocxTemplate> {
  const res = await axiosInstance.put(`${BASE}/${id}`, payload);
  return res.data;
}

export async function duplicateDocxTemplate(id: string): Promise<DocxTemplate> {
  const res = await axiosInstance.post(`${BASE}/${id}/duplicate`);
  return res.data;
}

export async function deleteDocxTemplate(id: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/${id}`);
}

export async function seedDocxTemplates(): Promise<{
  created: string[];
  skipped: string[];
}> {
  const res = await axiosInstance.post(`${BASE}/seed`);
  return res.data;
}

export interface DocxExportOptions {
  editorContent?: JSONContent;
  name?: string;
  values?: Record<string, string>;
}

export async function downloadDocxTemplate(
  id: string,
  fallbackName: string,
  options: DocxExportOptions = {},
): Promise<string[]> {
  const res = await axiosInstance.post(`${BASE}/${id}/export`, options, {
    responseType: "blob",
  });

  const disposition: string = res.headers["content-disposition"] || "";
  const filename =
    /filename="?([^";]+)"?/i.exec(disposition)?.[1] || `${fallbackName}.docx`;
  const url = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const raw: string | undefined = res.headers["x-export-warnings"];
  if (!raw) return [];
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

export async function getApiErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (!axios.isAxiosError(error)) return fallback;
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const text = (await data.text()).trim();
      if (text) {
        try {
          return JSON.parse(text).message || text;
        } catch {
          return text;
        }
      }
    } catch {
      return fallback;
    }
    return fallback;
  }
  if (typeof data === "string" && data.trim()) return data;
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string"
  )
    return data.message;
  return fallback;
}
