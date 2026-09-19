import type { JSONContent } from "@tiptap/react";

export type DocxPageSize = "A4" | "Letter" | "Legal";

export interface DocxPageSettings {
  size: DocxPageSize;
  margins: { top: number; right: number; bottom: number; left: number };
  background?: string;
  watermark?: { src?: string; opacity?: number };
}

export interface DocxTemplateAuthor {
  _id: string;
  name: string;
}

export interface DocxTemplateSummary {
  _id: string;
  name: string;
  slug: string;
  originalFilename?: string;
  page: DocxPageSettings;
  variables: string[];
  version: number;
  createdBy?: DocxTemplateAuthor | string | null;
  updatedBy?: DocxTemplateAuthor | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocxTemplate extends DocxTemplateSummary {
  editorContent: JSONContent;
}

export interface TemplateVariable {
  key: string;
  label: string;
  group:
    | "Resident"
    | "Barangay"
    | "Officials"
    | "Document"
    | "Document-specific";
  note?: string;
}

export interface UpdateDocxTemplatePayload {
  name?: string;
  editorContent?: JSONContent;
  page?: Partial<Pick<DocxPageSettings, "size">> & {
    margins?: Partial<DocxPageSettings["margins"]>;
  };
  expectedVersion: number;
}
