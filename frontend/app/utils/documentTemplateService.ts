import axios from "axios";
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
  pendingFee?: number;
  pendingFeeProposedBy?: { _id: string; name: string; email: string } | string;
  pendingFeeProposedAt?: string;
  priceApprovalStatus?: "none" | "pending" | "approved" | "rejected";
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

export const getPendingPriceApprovals = async (): Promise<DocumentTemplate[]> => {
  const { data } = await axiosInstance.get("/document-templates/pending-approvals");
  return data;
};

export interface PriceDecision {
  id: string;
  templateId: string;
  templateName: string;
  status: "approved" | "rejected";
  proposedFee: number | null;
  activeFee: number | null;
  previousFee: number | null;
  decidedBy: string;
  decidedAt: string;
}

interface PriceAuditEntry {
  _id: string;
  actor: string;
  action: string;
  entityId: string;
  entityLabel: string;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}

const toFee = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : Number(value);
  return value === undefined || value === null || Number.isNaN(n) ? null : n;
};

export const getPriceDecisionHistory = async (limit = 8): Promise<PriceDecision[]> => {
  const { data } = await axiosInstance.get<PriceAuditEntry[]>("/barangay/audit", {
    params: { entity: "documentTemplate" },
  });
  return data
    .filter((e) => e.action === "price_approved" || e.action === "price_rejected")
    .slice(0, limit)
    .map((e) => {
      const approved = e.action === "price_approved";
      return {
        id: e._id,
        templateId: e.entityId,
        templateName: e.entityLabel,
        status: approved ? "approved" : "rejected",
        proposedFee: approved ? toFee(e.newValue) : toFee(e.previousValue),
        activeFee: toFee(e.newValue),
        previousFee: approved ? toFee(e.previousValue) : toFee(e.newValue),
        decidedBy: e.actor,
        decidedAt: e.createdAt,
      };
    });
};

export const approveTemplatePrice = async (id: string): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.patch(`/document-templates/${id}/price/approve`);
  return data;
};

export const rejectTemplatePrice = async (id: string): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.patch(`/document-templates/${id}/price/reject`);
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

/**
 * Renders the active PDF template bound to a document request's type, filled
 * with that request's live data. Returns null when no template is bound (404),
 * so callers can fall back to the legacy certificate templates.
 */
export const renderPdfByType = async (requestId: string): Promise<Uint8Array | null> => {
  try {
    const response = await axiosInstance.post(
      "/document-templates/render-by-type",
      { requestId },
      { responseType: "arraybuffer" }
    );
    return new Uint8Array(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
};
