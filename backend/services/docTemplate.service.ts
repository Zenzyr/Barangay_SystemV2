import DocTemplate, { PAGE_SIZES } from "../model/docTemplate.model";
import { extractVariables, validateTiptapDoc, TiptapNode } from "../utils/tiptapDoc";
import { TEMPLATE_VARIABLE_KEYS } from "../utils/templateVariables";
import { SEED_TEMPLATES } from "../data/docTemplateSeed";

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

const LIST_FIELDS = "name slug originalFilename page version variables createdBy updatedBy createdAt updatedAt";

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
      // A copy is a user template: it must not claim the seed file's dedupe key.
      originalFilename: "",
      editorContent: structuredClone(source.editorContent),
      page: structuredClone(source.page),
      variables: source.variables,
      version: 1,
      createdBy,
      updatedBy: createdBy,
    });
    return this.get(String(copy._id));
  }

  static async remove(id: string): Promise<boolean> {
    const result = await DocTemplate.findByIdAndDelete(id);
    return !!result;
  }

  /**
   * Idempotent: creates each bundled template that does not exist yet (matched
   * by originalFilename) and never overwrites edits made to existing ones.
   */
  static async seed(createdBy?: string) {
    const created: string[] = [];
    const skipped: string[] = [];
    for (const seed of SEED_TEMPLATES) {
      if (await DocTemplate.exists({ originalFilename: seed.originalFilename })) {
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
