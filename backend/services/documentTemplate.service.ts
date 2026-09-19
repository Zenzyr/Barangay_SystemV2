import mongoose from "mongoose";
import DocumentTemplate, {
  IDocumentTemplate,
} from "../model/documentTemplate.model";
import BarangaySettings from "../model/barangaySettings.model";
import Official from "../model/official.model";
import DocumentRequestModel from "../model/documentRequest.model";
import {
  seedTemplateDefinitions,
  SeedTemplateDef,
} from "../data/documentTemplateSeed";
import { resolveVariableValues } from "../utils/templateVariables";
import { validateTiptapDoc } from "../utils/tiptapDoc";
import { legacyTemplateToTiptap } from "../utils/legacyTemplateToTiptap";

export class TemplateInputError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const MAX_MARGIN_PT = 216;

function stableJson(value: any): string {
  const clean = (v: any): any => {
    if (Array.isArray(v)) return v.map(clean);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.keys(v)
          .filter(
            (k) =>
              k !== "_id" && v[k] !== "" && v[k] !== undefined && v[k] !== null,
          )
          .sort()
          .map((k) => [k, clean(v[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(clean(value));
}

function assertValidTiptapInput(data: any) {
  if (
    data.contentFormat !== undefined &&
    !["elements", "tiptap"].includes(data.contentFormat)
  ) {
    throw new TemplateInputError(400, "Unsupported content format");
  }
  if (data.contentFormat === "tiptap" || data.editorContent !== undefined) {
    const error = validateTiptapDoc(data.editorContent);
    if (error) throw new TemplateInputError(400, error);
  }
  const margins = data.page?.margins;
  if (margins) {
    for (const side of ["top", "right", "bottom", "left"]) {
      const v = margins[side];
      if (
        v !== undefined &&
        !(typeof v === "number" && v >= 0 && v <= MAX_MARGIN_PT)
      ) {
        throw new TemplateInputError(
          400,
          "Page margins must be between 0 and 216 points",
        );
      }
    }
  }
}

// ─── Field catalog (used for the insert-field picker in the UI) ─────
export const DYNAMIC_FIELD_GROUPS: Record<string, Record<string, string>> = {
  resident: {
    fullName: "Full Name",
    address: "Address",
    birthDate: "Birth Date",
    dateOfBirth: "Date of Birth",
    civilStatus: "Civil Status",
    gender: "Gender",
    nationality: "Nationality",
    occupation: "Occupation",
    yearsOfResidency: "Years of Residency",
    purpose: "Purpose",
    contactNumber: "Contact Number",
    purok: "Purok",
    age: "Age",
    spouseName: "Spouse Name",
    annualIncome: "Annual Income",
    monthlyIncome: "Monthly Income",
    householdExpenses: "Monthly Household Expenses",
    workStatus: "Work Status",
    workplace: "Workplace / Company",
    expenseType: "Type of Unforeseen Expense",
    businessName: "Business Name",
    businessAddress: "Business Address",
    businessType: "Business Type",
    businessNature: "Nature of Business",
    titleNo: "Title No.",
    taxDeclarationNo: "Tax Declaration No.",
    landArea: "Land Area (sqm)",
    treeCount: "Number of Trees",
    treeType: "Tree Type",
    assistanceTo: "Assistance To",
  },
  certificate: {
    number: "Certificate Number",
    date: "Issue Date",
  },
  barangay: {
    name: "Barangay Name",
    address: "Barangay Address",
    municipality: "Municipality",
    province: "Province",
    region: "Region",
    captain: "Barangay Captain",
    punongBarangay: "Punong Barangay",
    secretary: "Barangay Secretary",
    contactNumber: "Barangay Contact Number",
  },
};

/** Human label for a dynamic field key, e.g. "resident.fullName" → "Full Name". */
export const FIELD_LABEL = (key: string): string => {
  const [group, field] = key.split(".");
  if (group && field && DYNAMIC_FIELD_GROUPS[group]) {
    return DYNAMIC_FIELD_GROUPS[group][field] || field;
  }
  return key;
};

// ─── Position/point helpers ─────────────────────────────────────────
export const PAGE_POINTS: Record<string, { width: number; height: number }> = {
  A4: { width: 595, height: 842 },
  LETTER: { width: 612, height: 792 },
};

export const pageDimensions = (template: Pick<IDocumentTemplate, "page">) => {
  const base = PAGE_POINTS[template.page.size] || PAGE_POINTS.A4;
  return template.page.orientation === "landscape"
    ? { width: base.height, height: base.width }
    : base;
};

// ─── Service ────────────────────────────────────────────────────────
export class DocumentTemplateService {
  static async getAll(filter: Record<string, any> = {}) {
    return await DocumentTemplate.find(filter).sort({ name: 1 });
  }

  static async get(id: string) {
    return await DocumentTemplate.findById(id);
  }

  /** Public list: only active templates, minimal projection. */
  static async getPublic() {
    return await DocumentTemplate.find({ status: "active" })
      .select(
        "name description documentType fee currency status version updatedAt",
      )
      .sort({ name: 1 })
      .lean();
  }

  static async getByDocumentType(documentType: string) {
    return await DocumentTemplate.findOne({ documentType, status: "active" });
  }

  static async getByIdOrType(idOrType: string) {
    if (mongoose.isValidObjectId(idOrType)) {
      const byId = await DocumentTemplate.findById(idOrType);
      if (byId) return byId;
    }
    return await DocumentTemplate.findOne({
      documentType: idOrType,
      status: "active",
    });
  }

  static async create(data: any, userId?: string) {
    assertValidTiptapInput(data);
    const isTiptap = data.contentFormat === "tiptap";
    const doc = new DocumentTemplate({
      ...data,
      version: 1,
      documentType: (data.documentType || "").trim(),
      contentFormat: isTiptap ? "tiptap" : "elements",
      editorContent: isTiptap ? data.editorContent : null,
      elements: Array.isArray(data.elements) ? data.elements : [],
      createdBy: userId,
      updatedBy: userId,
    });
    await doc.save();
    return doc;
  }

  /**
   * Update a template. Version bumps on real changes so a generated document
   * can be traced back to the template/version that produced it.
   */
  static async update(id: string, data: any, userId?: string) {
    const existing = await DocumentTemplate.findById(id);
    if (!existing) return null;
    assertValidTiptapInput(data);

    // Build the update payload.
    const update: Record<string, any> = {
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    };
    const savingTiptap = data.contentFormat === "tiptap";
    if (savingTiptap) delete update.elements;

    // Deep-compare content fields; bump the version only when the layout,
    // page or fee actually changed.
    const compareParts: Array<keyof IDocumentTemplate> = [
      savingTiptap ? "editorContent" : "elements",
      "page",
      "fee",
      "name",
      "description",
    ];
    const changed = compareParts.some((part) => {
      if (part === "editorContent") {
        return (
          existing.contentFormat !== "tiptap" ||
          JSON.stringify(existing.editorContent ?? null) !==
            JSON.stringify(data.editorContent ?? null)
        );
      }
      if (part === "elements") {
        return (
          JSON.stringify(existing.elements ?? []) !==
          JSON.stringify(data.elements ?? [])
        );
      }
      if (part === "page") {
        return (
          stableJson(existing.toObject().page ?? {}) !==
          stableJson(data.page ?? {})
        );
      }
      return String(existing[part] ?? "") !== String(data[part] ?? "");
    });

    if (changed) update.version = (existing.version || 1) + 1;
    update.isDefault =
      data.isDefault !== undefined ? data.isDefault : existing.isDefault;
    update.status = data.status !== undefined ? data.status : existing.status;

    const updated = await DocumentTemplate.findByIdAndUpdate(id, update, {
      new: true,
    });
    return updated;
  }

  static async getEditorContent(id: string) {
    const template = await DocumentTemplate.findById(id).lean();
    if (!template) return null;
    if (template.contentFormat === "tiptap" && template.editorContent) {
      return {
        format: "tiptap" as const,
        editorContent: template.editorContent,
        notes: [] as string[],
      };
    }
    const { editorContent, notes } = legacyTemplateToTiptap(template as any);
    return { format: "legacy-converted" as const, editorContent, notes };
  }

  static async buildVariableValues(data: any): Promise<Record<string, string>> {
    const context = await this.buildFieldContext(data);
    const kagawads = await Official.find({
      status: "active",
      position: /^barangay kagawad$/i,
    })
      .sort({ precedence: 1, fullName: 1 })
      .lean()
      .catch(() => []);
    return resolveVariableValues(context, {
      kagawadNames: (kagawads as any[]).map((k) => k.fullName).filter(Boolean),
    });
  }

  /** Create an independent copy of a template (new id, bumped version). */
  static async duplicate(id: string, userId?: string) {
    const existing = await DocumentTemplate.findById(id);
    if (!existing) return null;

    const {
      _id: _x,
      createdAt: _c,
      updatedAt: _u,
      ...copy
    } = existing.toObject();

    const stamp = Date.now().toString(36);
    const copyDoc = new DocumentTemplate({
      ...copy,
      name: `Copy — ${existing.name}`,
      documentType: `${existing.documentType}-copy-${stamp}`,
      version: 1,
      isDefault: false,
      createdBy: userId,
      updatedBy: userId,
    });
    await copyDoc.save();
    return copyDoc;
  }

  static async delete(id: string) {
    return await DocumentTemplate.findByIdAndDelete(id);
  }

  // ── Seeding ───────────────────────────────────────────────────────
  /** Create default templates for all known document types (idempotent). */
  static async seedDefaults() {
    const created: string[] = [];
    let existingCount = 0;
    for (const def of seedTemplateDefinitions) {
      const exists = await DocumentTemplate.findOne({
        documentType: def.documentType,
      });
      if (exists) {
        existingCount++;
        continue;
      }
      const {
        name,
        description,
        fee,
        documentType,
        title,
        body,
        signaturePosition,
      } = def;
      const elements = this.buildDefaultElements({
        title,
        body,
        documentType,
        signaturePosition,
      });
      await DocumentTemplate.create({
        name,
        description,
        documentType,
        fee,
        currency: "PHP",
        status: "active",
        isDefault: true,
        version: 1,
        page: {
          size: "A4",
          orientation: "portrait",
          unit: "pt",
          margins: { top: 50, right: 50, bottom: 50, left: 50 },
          background: "",
          watermark: "",
        },
        elements,
        signatoryConfig: {},
      });
      created.push(documentType);
    }
    return { created, existingCount, total: seedTemplateDefinitions.length };
  }

  static buildDefaultElements(opts: {
    title: string;
    body: string;
    documentType: string;
    signaturePosition: string;
  }): any[] {
    const elements: any[] = [];
    const add = (el: any) => elements.push({ zIndex: elements.length, ...el });
    const centerX = 297;

    // 1. Republic header
    add({
      id: "hdr-republic",
      type: "text",
      content: "REPUBLIC OF THE PHILIPPINES",
      x: 60,
      y: 46,
      width: 475,
      height: 16,
      fontSize: 12,
      fontWeight: "bold",
      alignment: "center",
    });
    add({
      id: "hdr-barangay",
      type: "text",
      content:
        "{{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}",
      x: 60,
      y: 66,
      width: 475,
      height: 14,
      fontSize: 11,
      alignment: "center",
    });
    add({
      id: "hdr-line",
      type: "line",
      x: 60,
      y: 92,
      width: 475,
      height: 1,
      strokeWidth: 1,
    });

    // 2. Title
    add({
      id: "title",
      type: "text",
      content: opts.title.toUpperCase(),
      x: 60,
      y: 120,
      width: 475,
      height: 26,
      fontSize: 16,
      fontWeight: "bold",
      underline: false,
      alignment: "center",
    });

    // 3. Certificate number + date line
    add({
      id: "meta-number",
      type: "dynamicText",
      field: "certificate.number",
      x: 60,
      y: 168,
      width: 240,
      height: 14,
      fontSize: 11,
      alignment: "left",
    });
    add({
      id: "meta-date",
      type: "dynamicText",
      field: "certificate.date",
      x: 340,
      y: 168,
      width: 195,
      height: 14,
      fontSize: 11,
      alignment: "right",
    });

    // 4. Body
    add({
      id: "body",
      type: "text",
      content: opts.body,
      x: 70,
      y: 200,
      width: 455,
      height: 300,
      fontSize: 12,
      alignment: "justify",
      lineHeight: 1.5,
      wrapText: true,
    });

    // 5. Signature block (right side)
    add({
      id: "sig-block",
      type: "signature",
      signaturePosition: opts.signaturePosition,
      x: 300,
      y: 640,
      width: 240,
      height: 110,
      alignment: "center",
    });

    return elements;
  }

  // ── Field resolution context ──────────────────────────────────────
  /**
   * Build the flat context that dynamic fields are resolved against, from a
   * document request (+ its resident), barangay settings and active officials.
   * Officials are ALWAYS read from the Officials collection so a leadership
   * change automatically flows into newly generated documents.
   */
  static async buildFieldContext(doc: any): Promise<Record<string, any>> {
    const resident =
      doc.resident && typeof doc.resident === "object"
        ? doc.resident
        : doc.residentId
          ? { _id: doc.residentId }
          : {};

    const settings = await BarangaySettings.findOne({})
      .lean()
      .catch(() => null);
    const bgy = (settings?.barangay as any) || {};
    const officials = await Official.find({ status: "active" })
      .lean()
      .catch(() => []);

    const officialByName = (position: string): string => {
      const o = (officials as any[]).find(
        (x) => x.position?.toLowerCase() === String(position).toLowerCase(),
      );
      return o ? o.fullName || "" : "";
    };

    const context: Record<string, any> = {
      resident: {
        fullName: doc.fullName || (resident as any).name || "",
        address: doc.address || (resident as any).address || "",
        birthDate: doc.dateOfBirth || (resident as any).dateOfBirth || "",
        dateOfBirth: doc.dateOfBirth || (resident as any).dateOfBirth || "",
        civilStatus: doc.civilStatus || (resident as any).civilStatus || "",
        gender: (resident as any).gender || "",
        nationality: doc.nationality || "",
        occupation: doc.occupation || "",
        yearsOfResidency: doc.yrsOfResidency ?? "",
        purpose: doc.purpose || "",
        contactNumber: doc.contact || (resident as any).contact || "",
        purok: doc.purok || (resident as any).purok || "",
        age: doc.age ?? "",
        spouseName: doc.spouseName || "",
        annualIncome: doc.annualIncome || "",
        monthlyIncome: doc.monthlyIncome || "",
        householdExpenses: doc.householdExpenses || "",
        workStatus: doc.workStatus || "",
        workplace: doc.workplace || "",
        expenseType: doc.expenseType || "",
        businessName: doc.businessName || "",
        businessAddress: doc.businessAddress || "",
        businessType: doc.businessType || "",
        businessNature: doc.businessNature || "",
        titleNo: doc.titleNo || "",
        taxDeclarationNo: doc.taxDeclarationNo || "",
        landArea: doc.landArea ?? "",
        treeCount: doc.treeCount ?? "",
        treeType: doc.treeType || "",
        assistanceTo: doc.assistanceTo || "",
      },
      certificate: {
        number: doc.documentNumber || "___________",
        date:
          doc.dateIssued ||
          new Date().toLocaleDateString("en-PH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
      },
      barangay: {
        name: bgy.name || "Barangay Rabon",
        address: bgy.address || "",
        municipality: bgy.municipality || "Rosario",
        province: bgy.province || "La Union",
        region: bgy.region || "",
        contactNumber: bgy.contactNumber || "",
        captain:
          officialByName("Punong Barangay") ||
          officialByName("Barangay Captain"),
        punongBarangay:
          officialByName("Punong Barangay") ||
          officialByName("Barangay Captain"),
        secretary: officialByName("Barangay Secretary"),
      },
      official: {} as Record<string, string>,
    };

    for (const o of officials as any[]) {
      if (o.position) context.official[o.position] = o.fullName || "";
    }

    return context;
  }

  /**
   * Resolve {{group.field}} placeholders (plus legacy {fieldKey}) inside a
   * template string. Unknown keys are left untouched so admins can spot them.
   */
  static resolveTemplateText = (
    text: string,
    context: Record<string, any>,
  ): string => {
    if (!text) return text;
    let out = text.replace(
      /\{\{([a-zA-Z0-9_.]+)\}\}/g,
      (match, key: string) => {
        const value = this.getDot(context, key);
        return value === undefined ? match : String(value);
      },
    );
    // Legacy single-brace placeholders ({fullName}, {dateIssuedDay}, ...)
    out = out.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (match, key: string) => {
      const value =
        this.getDot(context.resident, key) ??
        this.getDot(context.certificate, key);
      return value === undefined ? match : String(value);
    });
    return out;
  };

  static getDot(obj: any, path: string): any {
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      if (typeof cur === "object") cur = cur[p];
      // For official.* fallbacks like {{official.Punong Barangay}} keys may
      // contain spaces — match on the closest key case-insensitively.
      else return undefined;
    }
    if (cur === undefined) {
      // Last-chance: search keys case-insensitively for spaced keys.
      const last = parts[parts.length - 1];
      const parent = this.getDot(obj, parts.slice(0, -1).join("."));
      if (parent && typeof parent === "object") {
        const found = Object.keys(parent).find(
          (k) => k.toLowerCase() === String(last).toLowerCase(),
        );
        if (found !== undefined) return parent[found];
      }
    }
    return cur;
  }

  static async getRequestSnapshot(data: any) {
    const snapshot: Record<string, any> = {};
    const keys = [
      "fullName",
      "contact",
      "address",
      "dateOfBirth",
      "civilStatus",
      "nationality",
      "occupation",
      "yrsOfResidency",
      "purpose",
      "documentNumber",
      "dateIssued",
      "businessName",
      "businessAddress",
      "businessType",
      "businessNature",
      "workStatus",
      "workplace",
      "monthlyIncome",
      "expenseType",
      "householdExpenses",
      "assistanceTo",
      "titleNo",
      "taxDeclarationNo",
      "landArea",
      "treeCount",
      "treeType",
      "age",
      "spouseName",
      "annualIncome",
      "purok",
    ];
    for (const k of keys) {
      if (data?.[k] !== undefined && data?.[k] !== null && data[k] !== "")
        snapshot[k] = data[k];
    }
    return snapshot;
  }
}

export default DocumentTemplateService;
