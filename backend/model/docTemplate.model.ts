import mongoose, { Schema } from "mongoose";

// Word-style document templates edited in the browser with Tiptap. The
// content is stored as Tiptap/ProseMirror JSON (never binary DOCX) and can be
// exported to .docx on demand. Separate from DocumentTemplate (the JSON/visual
// pdf-lib layout builder), which is a different, unrelated system.

export const PAGE_SIZES = ["A4", "Letter", "Legal"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

const PageSchema = new Schema(
  {
    size: { type: String, enum: PAGE_SIZES, default: "Letter" },
    // Margins in points (1 pt = 1/72 in).
    margins: {
      top: { type: Number, default: 72 },
      right: { type: Number, default: 72 },
      bottom: { type: Number, default: 72 },
      left: { type: Number, default: 72 },
    },
    // Full-page background image (e.g. the decorative swirl border).
    background: { type: String, default: "" },
    // Centered image behind the text (e.g. faded barangay seal).
    watermark: {
      src: { type: String, default: "" },
      opacity: { type: Number, default: 0.12 },
    },
  },
  { _id: false }
);

// Where the template content is authored:
//   "editor"      – Tiptap/editorContent is the source (legacy, unchanged).
//   "original-docx" – the stored original DOCX package is the source; the
//                     editor content is kept as a lightweight preview only.
export const DOC_TEMPLATE_SOURCE_TYPES = ["editor", "original-docx"] as const;
export type DocTemplateSourceType = (typeof DOC_TEMPLATE_SOURCE_TYPES)[number];

// Metadata + the original DOCX binary (BSON BinData). The binary is stored
// inside the template document so the package travels atomically with its
// template — never inside editorContent. Sizes are small (<1 MB for the
// bundled originals; uploads capped at the existing 10 MB multer limit).
const OriginalDocxSchema = new Schema(
  {
    storage: { type: String, default: "database" },
    originalFilename: { type: String, trim: true, default: "" },
    mimeType: { type: String, default: "" },
    size: { type: Number, default: 0 },
    sha256: { type: String, trim: true, default: "" },
    data: { type: Buffer },
    uploadedAt: { type: Date, default: null },
  },
  { _id: false }
);

const DocTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    // Additive source indicator: default "editor" keeps every existing
    // template and all Tiptap editing behaviour untouched.
    sourceType: { type: String, enum: DOC_TEMPLATE_SOURCE_TYPES, default: "editor" },
    // Present only when an original DOCX package has been stored. `data` is
    // excluded from every default read; use getOriginalDocumentData() to fetch
    // the binary (e.g. the download endpoint or the Phase 2 OOXML renderer).
    originalDocx: { type: OriginalDocxSchema, default: undefined },
    // Maps the template to a document request code (e.g. certificateOfIndigency)
    // so the secretary's DOCX/PDF generation finds it when no static asset
    // exists. Empty for variants and user-created templates.
    documentType: { type: String, trim: true, default: "" },
    // Source .docx this template was recreated from (seed dedupe key). Empty
    // for user-created/duplicated templates.
    originalFilename: { type: String, trim: true, default: "" },
    editorContent: { type: Schema.Types.Mixed, required: true },
    page: { type: PageSchema, default: () => ({}) },
    // Derived from editorContent on every save — never trusted from clients.
    variables: [{ type: String }],
    version: { type: Number, required: true, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "Accounts", required: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Accounts", required: false },
  },
  { timestamps: true }
);

// Seed dedupe: at most one template per source file. Partial so user-made
// templates (empty originalFilename) never collide with each other.
DocTemplateSchema.index(
  { originalFilename: 1 },
  { unique: true, partialFilterExpression: { originalFilename: { $type: "string", $gt: "" } } }
);

// Lookups by document request code (render-by-type during generation).
DocTemplateSchema.index({ documentType: 1 });

export default mongoose.model("DocTemplate", DocTemplateSchema);
