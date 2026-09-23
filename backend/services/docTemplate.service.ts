import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose, { Schema } from "mongoose";
import DocTemplate, { PAGE_SIZES, DOC_TEMPLATE_SOURCE_TYPES, DocTemplateSourceType } from "../model/docTemplate.model";
import { extractVariables, validateTiptapDoc, TiptapNode } from "../utils/tiptapDoc";
import { TEMPLATE_VARIABLE_KEYS } from "../utils/templateVariables";
import { SEED_TEMPLATES } from "../data/docTemplateSeed";
import { isDocxPackage, sha256Hex, toOriginalDocxBuffer, readZipEntry, replaceZipEntry } from "../utils/docxPackage";
import { replacePlaceholdersInDocumentXml } from "../utils/ooxmlPlaceholder";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export class DocTemplateError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "template";

const LIST_FIELDS =
  "name slug sourceType documentType originalFilename page version variables createdBy updatedBy createdAt updatedAt";

// Default reads never carry the binary (keeps list/get JSON small). The bytes
// are only fetched explicitly via getOriginalDocumentData().
const WITHOUT_BINARY_SELECT = "-originalDocx.data";

const isFiniteMargin = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 216;

/** Validates a client-supplied page config. Returns an error string or null. */
export function validatePage(page: any): string | null {
  if (page === undefined) return null;
  if (!page || typeof page !== "object") return "Invalid page settings";
  if (page.size !== undefined && !PAGE_SIZES.includes(page.size)) return "Unsupported page size";
  if (page.margins !== undefined) {
    if (!page.margins || typeof page.margins !== "object") return "Invalid page margins";
    for (const side of ["top", "right", "bottom", "left"]) {
      if (page.margins[side] !== undefined && !isFiniteMargin(page.margins[side])) {
        return "Page margins must be between 0 and 216 points";
      }
    }
  }
  return null;
}

export class DocTemplateService {
  static async list() {
    return DocTemplate.find({})
      .select(LIST_FIELDS)
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .sort({ name: 1 })
      .lean();
  }

  static async get(id: string) {
    return DocTemplate.findById(id)
      .select(WITHOUT_BINARY_SELECT)
      .populate("createdBy", "name")
      .populate("updatedBy", "name")
      .lean();
  }

  /**
   * Saves editor content. `expectedVersion` gives optimistic concurrency: if
   * someone else saved since the editor loaded, the write is rejected (409)
   * instead of silently overwriting their work. `variables` is always derived
   * from the content — never trusted from the client.
   */
  static async update(
    id: string,
    body: { name?: unknown; editorContent?: unknown; page?: any; expectedVersion?: unknown },
    updatedBy?: string
  ) {
    const template = await DocTemplate.findById(id);
    if (!template) return null;

    if (body.expectedVersion !== undefined && body.expectedVersion !== template.version) {
      throw new DocTemplateError(409, "This template was changed by someone else. Reload it before saving.");
    }

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw new DocTemplateError(400, "Template name is required");
      if (name.length > 150) throw new DocTemplateError(400, "Template name is too long");
      template.name = name;
    }

    if (body.editorContent !== undefined) {
      const error = validateTiptapDoc(body.editorContent);
      if (error) throw new DocTemplateError(400, error);
      template.editorContent = body.editorContent;
      template.set("variables", extractVariables(body.editorContent as TiptapNode));
      template.markModified("editorContent");
    }

    const pageError = validatePage(body.page);
    if (pageError) throw new DocTemplateError(400, pageError);
    if (body.page) {
      if (body.page.size) template.set("page.size", body.page.size);
      for (const side of ["top", "right", "bottom", "left"]) {
        if (body.page.margins?.[side] !== undefined) template.set(`page.margins.${side}`, body.page.margins[side]);
      }
    }

    template.version = (template.version || 1) + 1;
    if (updatedBy) template.updatedBy = updatedBy as any;
    await template.save();
    return this.get(String(template._id));
  }

  static async duplicate(id: string, createdBy?: string) {
    const source = await DocTemplate.findById(id).lean();
    if (!source) return null;

    const baseName = `${source.name} (Copy)`.slice(0, 150);
    const baseSlug = slugify(baseName);
    let slug = baseSlug;
    for (let n = 2; await DocTemplate.exists({ slug }); n++) slug = `${baseSlug}-${n}`;

    const copy = await DocTemplate.create({
      name: baseName,
      slug,
      // A copy is a user template: it must not claim the seed file's dedupe key
      // nor shadow the document type the original is bound to.
      originalFilename: "",
      documentType: "",
      editorContent: structuredClone(source.editorContent),
      page: structuredClone(source.page),
      variables: source.variables,
      version: 1,
      createdBy,
      updatedBy: createdBy,
    });
    return this.get(String(copy._id));
  }

  /** The template bound to a document request code, if any. */
  static async getByDocumentType(documentType: string) {
    if (!documentType) return null;
    return DocTemplate.findOne({ documentType }).select(WITHOUT_BINARY_SELECT).lean();
  }

  static async remove(id: string): Promise<boolean> {
    const result = await DocTemplate.findByIdAndDelete(id);
    return !!result;
  }

  /**
   * Stores an original DOCX package as the template's source document and
   * flips `sourceType` to "original-docx". The binary remains an untouched,
   * byte-for-byte copy of the upload (fingerprinted with SHA-256). The Tiptap
   * editorContent is deliberately left in place as a preview. Returns null
   * when the template does not exist.
   */
  static async uploadOriginalDocx(
    id: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
    updatedBy?: string
  ) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new DocTemplateError(400, "A .docx file is required");
    }
    if (!isDocxPackage(file.buffer)) {
      throw new DocTemplateError(400, "The uploaded file is not a valid .docx document");
    }

    const template = await DocTemplate.findById(id);
    if (!template) return null;

    const originalFilename =
      path
        .basename(file.originalname || "document.docx")
        .replace(/[^\w.\- ]+/g, "_")
        .slice(0, 100) || "document.docx";

    template.sourceType = "original-docx";
    template.set("originalDocx", {
      storage: "database",
      originalFilename,
      mimeType: file.mimetype || DOCX_MIME,
      size: file.buffer.length,
      sha256: sha256Hex(file.buffer),
      data: file.buffer,
      uploadedAt: new Date(),
    });
    template.markModified("originalDocx");
    template.version = (template.version || 1) + 1;
    if (updatedBy) template.updatedBy = updatedBy as any;
    await template.save();
    return this.get(String(template._id));
  }

  /**
   * The original DOCX package (template metadata + binary). Returns null when
   * the template does not exist or has no stored original document. This is
   * the only path that reads the binary — used by the download endpoint and,
   * later, the OOXML placeholder renderer.
   */
  static async getOriginalDocumentData(id: string) {
    const template = await DocTemplate.findById(id).lean();
    if (!template) return null;
    const raw = (template as any).originalDocx;
    let data = raw?.data;
    // Mongoose hands a lean-read BinData back as the BSON `Binary` wrapper (not
    // a Buffer); a direct Buffer read already returns a Buffer. Coerce both.
    if (data && (data as any)._bsontype === "Binary") {
      data = Buffer.from((data as any).buffer);
    }
    if (!Buffer.isBuffer(data) || data.length === 0) return null;
    return { template, data };
  }

  /**
   * Fills {{variables}} directly inside the stored original DOCX package and
   * returns the rewritten package as a buffer, preserving every other part of
   * the file. Returns null when the template has no stored original or the
   * package cannot be re-built.
   */
  static async renderOriginalDocx(id: string, values: Record<string, string>) {
    const original = await this.getOriginalDocumentData(id);
    if (!original) return null;
    const { template, data } = original;

    const documentXml = readZipEntry(data, "word/document.xml");
    if (documentXml === null) {
      throw new DocTemplateError(409, "The stored original document is missing word/document.xml");
    }

    const filled = replacePlaceholdersInDocumentXml(documentXml.toString("utf8"), values);

    const buffer = replaceZipEntry(data, "word/document.xml", Buffer.from(filled, "utf8"));
    if (!buffer) {
      throw new DocTemplateError(500, "Failed to rebuild the DOCX package");
    }
    return { buffer, warnings: [] as string[], template };
  }

  private static async loadOriginalDocxFile(filename: string) {
    const filePath = path.join(path.resolve(process.cwd(), "..", "frontend", "docs"), filename);
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    return {
      buffer,
      originalname: filename,
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sha256: sha256Hex(buffer),
    };
  }

  /**
   * Idempotent: creates each bundled template that does not exist yet (matched
   * by originalFilename) and never overwrites edits made to existing ones.
   */
  static async seed(createdBy?: string) {
    const created: string[] = [];
    const skipped: string[] = [];
    for (const seed of SEED_TEMPLATES) {
      const existing = await DocTemplate.findOne({ originalFilename: seed.originalFilename });
      if (existing) {
        // Backfill the document-type binding on templates seeded before the
        // field existed, without touching the admin's content edits.
        if (seed.documentType && !existing.documentType) {
          await DocTemplate.updateOne(
            { _id: existing._id },
            { $set: { documentType: seed.documentType } }
          );
        }
        // Backfill binary data if originalFilename exists and binary is missing
        if (seed.originalFilename && !existing.originalDocx) {
          const data = await this.loadOriginalDocxFile(seed.originalFilename);
          if (data) {
             existing.sourceType = "original-docx";
             existing.originalDocx = {
                storage: "database",
                originalFilename: seed.originalFilename,
                mimeType: data.mimetype,
                size: data.buffer.length,
                sha256: data.sha256,
                data: data.buffer,
                uploadedAt: new Date(),
             } as any;
             await existing.save();
          }
        }
        skipped.push(seed.originalFilename);
        continue;
      }
      const error = validateTiptapDoc(seed.editorContent);
      if (error) throw new Error(`Seed template "${seed.name}" is invalid: ${error}`);
      const variables = extractVariables(seed.editorContent);
      const unknown = variables.filter((key) => !TEMPLATE_VARIABLE_KEYS.has(key));
      if (unknown.length) throw new Error(`Seed template "${seed.name}" uses unknown variables: ${unknown.join(", ")}`);

      let slug = seed.slug;
      for (let n = 2; await DocTemplate.exists({ slug }); n++) slug = `${seed.slug}-${n}`;
      await DocTemplate.create({
        name: seed.name,
        slug,
        documentType: seed.documentType || "",
        originalFilename: seed.originalFilename,
        editorContent: seed.editorContent,
        page: seed.page,
        variables,
        version: 1,
        createdBy,
        updatedBy: createdBy,
      });
      created.push(seed.originalFilename);
    }
    return { created, skipped };
  }
}
