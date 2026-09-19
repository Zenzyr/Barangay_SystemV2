export type DocumentPageSize = "A4" | "Letter" | "Legal";

export interface DocumentPageSettings {
  size: DocumentPageSize;
  margins: { top: number; right: number; bottom: number; left: number };
  orientation?: "portrait" | "landscape";
  background?: string;
  watermark?: { src?: string; opacity?: number };
  watermarkText?: string;
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
