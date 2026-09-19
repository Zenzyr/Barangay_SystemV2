import mongoose, { Schema } from "mongoose";

// ── Element kinds renderable by the data-driven template engine ─────
export const TEMPLATE_ELEMENT_TYPES = [
  "text", // static or placeholder text ({{...}} resolved at render)
  "dynamicText", // bound directly to a field, e.g. resident.fullName
  "image", // logo / seal / background / photo (URL or data-uri)
  "signature", // signature block (uses the active official's signature image)
  "line", // horizontal/vertical rule
  "rect", // bordered rectangle (frame / box)
  "table", // simple two-column label/value table
] as const;

// Page sizes in points (pt). A4 = 595 x 842; Letter = 612 x 792.
export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 595, height: 842 },
  LETTER: { width: 612, height: 792 },
};

export interface ITemplateElement {
  id: string;
  type: (typeof TEMPLATE_ELEMENT_TYPES)[number];
  // text / dynamicText content. dynamicText uses `field` instead.
  content?: string;
  /** Dynamic field key, e.g. "resident.fullName" or "barangay.captain". */
  field?: string;
  /** Image URL / data-uri for image elements. */
  source?: string;
  /** Position + size, in points, relative to the page (not margins). */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;

  // Typography (text elements)
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  underline?: boolean;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;

  // Shapes / boxes
  strokeWidth?: number;
  strokeColor?: string;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  borderRadius?: number;
  fillOpacity?: number;
  borderStyle?: "solid" | "dashed" | "dotted";

  // Image fit
  imageFit?: "contain" | "cover" | "stretch";

  // Signature element config
  signaturePosition?: string; // official position, e.g. "Punong Barangay"

  // Table element config
  rows?: { label: string; value: string }[];
  columns?: number;

  // Text wrapping toggle (defaults to true)
  wrapText?: boolean;
}

export interface IDocumentTemplate {
  name: string;
  description: string;
  documentType: string; // unique machine key, e.g. "certificateOfIndigency"
  fee: number;
  currency: string;
  status: "active" | "inactive";
  isDefault: boolean;
  version: number;

  page: {
    size: "A4" | "LETTER";
    orientation: "portrait" | "landscape";
    unit: "pt" | "in";
    margins: { top: number; right: number; bottom: number; left: number };
    background?: string; // background image URL applied to the whole page
    watermark?: string; // faint repeated text
  };

  contentFormat?: "elements" | "tiptap";
  editorContent?: Record<string, any> | null;

  elements: ITemplateElement[];

  // Optional legacy signatory overrides (kept so old data keeps working).
  signatoryConfig?: Record<
    string,
    { name: string; position: string; signatureImage?: string }
  >;

  createdBy?: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const TemplateElementSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: TEMPLATE_ELEMENT_TYPES, required: true },
    content: { type: String, default: "" },
    field: { type: String, default: "" },
    source: { type: String, default: "" },
    x: { type: Number, required: true, default: 0 },
    y: { type: Number, required: true, default: 0 },
    width: { type: Number, required: true, default: 100 },
    height: { type: Number, required: true, default: 20 },
    rotation: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },

    fontFamily: { type: String, default: "Times New Roman" },
    fontSize: { type: Number, default: 11 },
    fontWeight: { type: String, enum: ["normal", "bold"], default: "normal" },
    fontStyle: { type: String, enum: ["normal", "italic"], default: "normal" },
    underline: { type: Boolean, default: false },
    color: { type: String, default: "#000000" },
    alignment: {
      type: String,
      enum: ["left", "center", "right", "justify"],
      default: "left",
    },
    lineHeight: { type: Number, default: 1.4 },
    letterSpacing: { type: Number, default: 0 },

    strokeWidth: { type: Number, default: 1 },
    strokeColor: { type: String, default: "#000000" },
    borderColor: { type: String, default: "#000000" },
    borderWidth: { type: Number, default: 1 },
    backgroundColor: { type: String, default: "transparent" },
    borderRadius: { type: Number, default: 0 },
    fillOpacity: { type: Number, default: 1 },
    borderStyle: {
      type: String,
      enum: ["solid", "dashed", "dotted"],
      default: "solid",
    },

    imageFit: {
      type: String,
      enum: ["contain", "cover", "stretch"],
      default: "contain",
    },
    signaturePosition: { type: String, default: "" },
    rows: { type: Schema.Types.Mixed, default: [] },
    columns: { type: Number, default: 2 },
    wrapText: { type: Boolean, default: true },
  },
  { _id: false },
);

const DocumentTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    documentType: { type: String, required: true, unique: true, trim: true },
    fee: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: "PHP" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isDefault: { type: Boolean, default: false },
    version: { type: Number, default: 1 },

    page: {
      size: { type: String, enum: ["A4", "LETTER"], default: "A4" },
      orientation: {
        type: String,
        enum: ["portrait", "landscape"],
        default: "portrait",
      },
      unit: { type: String, enum: ["pt", "in"], default: "pt" },
      margins: {
        top: { type: Number, default: 50 },
        right: { type: Number, default: 50 },
        bottom: { type: Number, default: 50 },
        left: { type: Number, default: 50 },
      },
      background: { type: String, default: "" },
      watermark: { type: String, default: "" },
    },

    contentFormat: {
      type: String,
      enum: ["elements", "tiptap"],
      default: "elements",
    },
    editorContent: { type: Schema.Types.Mixed, default: null },

    elements: { type: [TemplateElementSchema], default: [] },

    signatoryConfig: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: "Accounts" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Accounts" },
  },
  { timestamps: true },
);

DocumentTemplateSchema.index({ documentType: 1 }, { unique: true });
DocumentTemplateSchema.index({ status: 1 });

export default mongoose.model<IDocumentTemplate>(
  "DocumentTemplate",
  DocumentTemplateSchema,
);
