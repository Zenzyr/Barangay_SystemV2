import type { JSONContent } from "@tiptap/react";
import type { DocumentPageSettings, DocumentPageSize, TemplateVariable } from "./documentEditor.type";

export type { TemplateVariable };

export type DocxPageSize = DocumentPageSize;
export type DocxPageSettings = DocumentPageSettings;

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

export interface UpdateDocxTemplatePayload {
  name?: string;
  editorContent?: JSONContent;
  page?: Partial<Pick<DocxPageSettings, "size">> & {
    margins?: Partial<DocxPageSettings["margins"]>;
  };
  expectedVersion: number;
}
