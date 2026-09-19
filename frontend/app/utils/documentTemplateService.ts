import axiosInstance from "@/app/utils/axios";
import type { JSONContent } from "@tiptap/react";

// ─── Types ────────────────────────────────────────────────────────
export interface TemplateElement {
  id: string;
  type: "text" | "dynamicText" | "image" | "signature" | "line" | "rect" | "table";
  content?: string;
  field?: string;
  source?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  underline?: boolean;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  strokeWidth?: number;
  strokeColor?: string;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  imageFit?: "contain" | "cover" | "stretch";
  signaturePosition?: string;
  rows?: { label: string; value: string }[];
  wrapText?: boolean;
}

export interface DocumentTemplate {
  _id: string;
  name: string;
  description: string;
  documentType: string;
  fee: number;
  currency: string;
  status: "active" | "inactive";
  isDefault: boolean;
  version: number;
  page: {
    size: "A4" | "LETTER";
    orientation: "portrait" | "landscape";
    unit: "pt";
    margins: { top: number; right: number; bottom: number; left: number };
    background?: string;
    watermark?: string;
  };
  /** "elements" (legacy absolute layout, also when missing) or "tiptap" (flowing document in editorContent). */
  contentFormat?: "elements" | "tiptap";
  elements: TemplateElement[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── API ──────────────────────────────────────────────────────────
export const getTemplates = async (params?: Record<string, string>): Promise<DocumentTemplate[]> => {
  const { data } = await axiosInstance.get("/document-templates", { params });
  return data;
};

export const getPublicTemplates = async (): Promise<DocumentTemplate[]> => {
  const { data } = await axiosInstance.get("/document-templates/public");
  return data;
};

export const getTemplate = async (id: string): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.get(`/document-templates/${id}`);
  return data;
};

export const createTemplate = async (template: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.post("/document-templates", template);
  return data;
};

export const updateTemplate = async (id: string, template: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.put(`/document-templates/${id}`, template);
  return data;
};

export const deleteTemplate = async (id: string) => {
  const { data } = await axiosInstance.delete(`/document-templates/${id}`);
  return data;
};

export const duplicateTemplate = async (id: string): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.post(`/document-templates/${id}/duplicate`);
  return data;
};

export const seedTemplates = async (): Promise<{ created: string[] }> => {
  const { data } = await axiosInstance.post("/document-templates/seed");
  return data;
};

export const fetchTemplatePreviewPdf = async (id: string): Promise<string> => {
  const response = await axiosInstance.get(`/document-templates/${id}/preview`, { responseType: "blob" });
  const blob = new Blob([response.data], { type: "application/pdf" });
  return URL.createObjectURL(blob);
};

/** What the editor opens: the stored Tiptap document, or a converted draft of a legacy layout. */
export interface TemplateEditorContent {
  format: "tiptap" | "legacy-converted";
  editorContent: JSONContent;
  /** What could not be carried over when converting a legacy layout. */
  notes: string[];
}

export const getTemplateEditorContent = async (id: string): Promise<TemplateEditorContent> => {
  const { data } = await axiosInstance.get(`/document-templates/${id}/editor-content`);
  return data;
};

/** PDF preview (sample data) of editor content that has not been saved yet. */
export const previewTemplateContentPdf = async (
  editorContent: JSONContent,
  page: DocumentTemplate["page"]
): Promise<string> => {
  const response = await axiosInstance.post("/document-templates/preview", { editorContent, page }, { responseType: "blob" });
  return URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
};
