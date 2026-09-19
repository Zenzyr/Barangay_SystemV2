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

const DocTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
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

export default mongoose.model("DocTemplate", DocTemplateSchema);
