import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { barangaySettings } from "@/app/types/barangaySettings.type";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import axiosInstance from "./axios";
import { formatDateParts, formatFieldValue, formatDateMDY } from "./documentFormat";
import { getDocumentLayout, DocumentLayout } from "./documentLayouts";
import { viewDocumentPDF, generateDocumentPDF } from "./dynamicDocumentGenerator";

/**
 * DOCX template engine (docxtemplater + PizZip).
 *
 * Each editable Word template is a `.docx` shipped in
 * `public/assets/document-template/` with `{{variable}}` placeholders, plus a
 * sibling `.json` definition (delimiters, variable registry, data mapping).
 * `buildDocumentData` assembles the data object for a document request from
 * the denormalized request fields, live barangay settings and the active
 * official roster (same sources as the PDF path in dynamicDocumentGenerator).
 *
 * The templates are split from the barangay's original ~5 .docx files; the
 * registry below mirrors every document code they map to.
 */

function stripHonorific(name: string): string {
  return name.replace(/^HON\.\s*/i, "").trim();
}

export interface DocxTemplateDefinition {
  document: string;
  name?: string;
  engine: "docxtemplater";
  templateFile: string;
  originalFile?: string;
  delimiters: { start: string; end: string };
  variables: string[];
  /** Variables that must resolve to a non-empty value before rendering. */
  requiredFields?: string[];
}

export interface DocxTemplateRenderData {
  resident: {
    fullName: string;
    gender: string;
    civilStatus: string;
    purok: string;
    spouseName: string;
    annualIncome: string;
  };
  certificate: {
    day: string;
    dayOrdinal: string;
    dayOrdinalLower: string;
    month: string;
    year: string;
    pronoun: string;
    subjectPronoun: string;
    singleMark: string;
    marriedMark: string;
    widowMark: string;
    mrMrs: string;
    dateShort: string;
    purpose: string;
  };
  barangay: {
    name: string;
    municipality: string;
    province: string;
    punongBarangay: string;
  };
  officials: {
    punongBarangay: string;
    secretary: string;
    treasurer: string;
    skChairperson: string;
  };
  sangguniangBarangay: {
    member0: string;
    member1: string;
    member2: string;
    member3: string;
    member4: string;
    member5: string;
    member6: string;
  };
  beneficiary: { name: string };
  recipient: { name: string; position: string; location: string };
  applicant: {
    fullName: string;
    age: string;
    addressUpper: string;
    workStatus: string;
    workplace: string;
    monthlyIncome: string;
    expenseType: string;
    householdExpenses: string;
  };
  student: { name: string; purok: string };
  property: { titleNumber: string; taxDeclarationNo: string; area: string };
  tree: { count: string; countWord: string; type: string };
}

/**
 * Registry of document codes → their editable DOCX definition file. Adding a
 * new editable document only requires dropping a `-template.docx` + `.json`
 * pair in the assets folder and registering the code here.
 */
const DOCX_TEMPLATE_INDEX: Record<string, string> = {
  certificateOfIndigency:
    "/assets/document-template/certificate-of-indigency-template.json",
  barangayCertification:
    "/assets/document-template/barangay-certification-template.json",
  certificateOfResidency:
    "/assets/document-template/barangay-residency-template.json",
  certificateOfLowIncome:
    "/assets/document-template/certificate-of-low-income-template.json",
  endorsementLetter:
    "/assets/document-template/endorsement-letter-template.json",
  certificateOfFirstTimeJobseeker:
    "/assets/document-template/ftj-certification-template.json",
  firstTimeJobseekerOath: "/assets/document-template/ftj-oath-template.json",
  certificationOfTreesCutting:
    "/assets/document-template/certification-of-trees-cutting-template.json",
  certificateOfAttestation:
    "/assets/document-template/certificate-of-attestation-template.json",
};

export async function getDocxTemplateSpec(
  document: string
): Promise<DocxTemplateDefinition | undefined> {
  const url = DOCX_TEMPLATE_INDEX[document];
  if (!url) return undefined;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to load DOCX template definition (${url}): HTTP ${res.status}`
    );
  }
  return (await res.json()) as DocxTemplateDefinition;
}

/** Sync check whether a document code has a shipped Word template. */
export function isDocxTemplated(document: string): boolean {
  return document in DOCX_TEMPLATE_INDEX;
}

// ── Data resolution ────────────────────────────────────────────────
function residentFullName(doc: documentRequestInterface): string {
  const r = doc.resident as { name?: string } | undefined;
  if (r && typeof r === "object" && r.name) return r.name;
  return doc.fullName || "";
}

function residentGender(doc: documentRequestInterface): string {
  const r = doc.resident as { gender?: string } | undefined;
  return r && typeof r === "object" && typeof r.gender === "string" ? r.gender : "";
}

/**
 * Normalize the civil status field to the checkbox wording used on the
 * official templates: "single" / "married" / "widow".
 */
function civilStatusWord(doc: documentRequestInterface): string {
  const raw = (doc.civilStatus || "").toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("single")) return "single";
  if (raw.startsWith("married")) return "married";
  if (raw.startsWith("widow")) return "widow";
  if (raw.startsWith("separated")) return "widow";
  if (raw.startsWith("divor")) return "widow";
  return raw;
}

/** "/" in the bracket of the matching civil status; empty elsewhere. */
function civilMark(doc: documentRequestInterface, which: string): string {
  return civilStatusWord(doc) === which ? "/" : "";
}

/** The COI reads "…to her / his by the duly constituted authorities…". */
function certificatePronoun(doc: documentRequestInterface): string {
  return /^male$/i.test(residentGender(doc)) ? "his" : "her";
}

/** Checkbox-style "He" / "She" used on the Barangay Certification. */
function subjectPronoun(doc: documentRequestInterface): string {
  return /^male$/i.test(residentGender(doc)) ? "He" : "She";
}

/** "Mr." / "Mrs." / "Ms." honorific used on the Attestation and Trees docs. */
function mrMrsFor(doc: documentRequestInterface): string {
  if (/^male$/i.test(residentGender(doc))) return "Mr.";
  const status = civilStatusWord(doc);
  return status === "married" || status === "widow" ? "Mrs." : "Ms.";
}

/** "15" → "15TH" (uppercase ordinal; the COI template prints "<day><ordinal>" as one unit). */
function dayOrdinalFrom(dateIssued: string | number | null | undefined): string {
  if (dateIssued == null) return "";
  const dt = new Date(dateIssued);
  if (Number.isNaN(dt.getTime())) return "";
  const d = dt.getDate();
  if (d % 100 >= 11 && d % 100 <= 13) return `${d}TH`;
  switch (d % 10) {
    case 1:
      return `${d}ST`;
    case 2:
      return `${d}ND`;
    case 3:
      return `${d}RD`;
    default:
      return `${d}TH`;
  }
}

/** "June 02, 2026" — 2-digit day used on the Endorsement Letter header. */
function dateShortFrom(dateIssued: string | number | null | undefined): string {
  if (dateIssued == null) return "";
  const dt = new Date(dateIssued);
  if (Number.isNaN(dt.getTime())) return "";
  const month = dt.toLocaleDateString("en-US", { month: "long" });
  const day = String(dt.getDate()).padStart(2, "0");
  return `${month} ${day}, ${dt.getFullYear()}`;
}

const ONE_TO_NINETEEN = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];

/** "3" → "three" (supports 0–999). */
function numberToWord(n: number): string {
  if (Number.isNaN(n)) return "";
  if (n < 20) return ONE_TO_NINETEEN[n] || String(n);
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const u = n % 10;
    return u ? `${t} ${ONE_TO_NINETEEN[u]}` : t;
  }
  const h = ONE_TO_NINETEEN[Math.floor(n / 100)];
  const rest = n % 100;
  return rest ? `${h} hundred ${numberToWord(rest)}` : `${h} hundred`;
}

/** "Php 6,000.00" or "₱ 500" → "6,000.00" (template already prints "Php"). */
function stripCurrencyPrefix(value: string | null | undefined): string {
  if (!value) return "";
  return String(value).replace(/^\s*(php|₱)\s*/i, "").trim();
}

export function buildDocumentData(
  doc: documentRequestInterface,
  settings?: barangaySettings,
  activeByPosition: Record<string, string> = {},
  rosterByPosition: Record<string, string[]> = {}
): DocxTemplateRenderData {
  const parts = formatDateParts(doc.dateIssued ?? "");
  const barangay = settings?.barangay;
  const municipality = barangay?.municipality || "Rosario";
  const province = barangay?.province || "La Union";
  const kagawads = rosterByPosition["Barangay Kagawad"] || [];
  const dayNumber = parts ? String(new Date(doc.dateIssued as string).getDate()) : "";
  const annualIncome = stripCurrencyPrefix(doc.annualIncome);
  const treeCount = Number(doc.treeCount);
  const civilStatus = civilStatusWord(doc);

  return {
    resident: {
      fullName: residentFullName(doc),
      gender: residentGender(doc),
      civilStatus,
      purok: doc.purok || "",
      spouseName: doc.spouseName || "",
      annualIncome,
    },
    certificate: {
      day: dayNumber,
      dayOrdinal: dayOrdinalFrom(doc.dateIssued),
      dayOrdinalLower: dayOrdinalFrom(doc.dateIssued).toLowerCase(),
      month: parts ? parts.month : "",
      year: parts ? parts.year : "",
      pronoun: certificatePronoun(doc),
      subjectPronoun: subjectPronoun(doc),
      singleMark: civilMark(doc, "single"),
      marriedMark: civilMark(doc, "married"),
      widowMark: civilMark(doc, "widow"),
      mrMrs: mrMrsFor(doc),
      dateShort: dateShortFrom(doc.dateIssued),
      purpose: doc.purpose || "",
    },
    barangay: {
      name: barangay?.name || "Barangay Rabon",
      municipality,
      province,
      punongBarangay: stripHonorific(activeByPosition["Punong Barangay"] || ""),
    },
    officials: {
      punongBarangay: stripHonorific(activeByPosition["Punong Barangay"] || ""),
      secretary: activeByPosition["Barangay Secretary"] || "",
      treasurer: activeByPosition["Barangay Treasurer"] || "",
      skChairperson: activeByPosition["SK Chairperson"] || "",
    },
    sangguniangBarangay: {
      member0: kagawads[0] || "",
      member1: kagawads[1] || "",
      member2: kagawads[2] || "",
      member3: kagawads[3] || "",
      member4: kagawads[4] || "",
      member5: kagawads[5] || "",
      member6: kagawads[6] || "",
    },
    beneficiary: { name: doc.assistanceTo || "" },
    recipient: (() => {
      const mayor = settings?.externalRecipients?.find(
        (r) => r.label === "Mayor" || r.position === "Mayor"
      );
      return {
        name: mayor?.name || "",
        position: mayor?.position || "Mayor",
        location: `${municipality}, ${province}`,
      };
    })(),
    applicant: {
      fullName: residentFullName(doc),
      age: doc.age || "",
      addressUpper: (doc.address || "").toUpperCase(),
      workStatus: doc.workStatus || "",
      workplace: doc.workplace || "",
      monthlyIncome: stripCurrencyPrefix(doc.monthlyIncome),
      expenseType: doc.expenseType || "",
      householdExpenses: stripCurrencyPrefix(doc.householdExpenses),
    },
    student: {
      name: residentFullName(doc),
      purok: doc.purok || "",
    },
    property: {
      titleNumber: doc.titleNo || "",
      taxDeclarationNo: doc.taxDeclarationNo || "",
      area: doc.landArea || "",
    },
    tree: {
      count: doc.treeCount || "",
      countWord: numberToWord(treeCount),
      type: doc.treeType || "",
    },
  };
}

// ── Renderer ───────────────────────────────────────────────────────
/**
 * docxtemplater's default parser treats `{{resident.fullName}}` as a single
 * flat key unless the angular-expressions package is installed (it is not a
 * runtime dependency). The templates only use plain dotted-path placeholders,
 * so a small path parser is used instead.
 */
function dottedParser(tag: string) {
  return {
    get(scope: unknown): unknown {
      if (tag === ".") return scope;
      if (scope == null) return scope;
      let value: unknown = scope;
      for (const key of String(tag).split(".")) {
        if (key === "this" || value == null) break;
        value = (value as Record<string, unknown>)[key];
      }
      return value;
    },
  };
}

export async function renderDocxTemplate(
  spec: DocxTemplateDefinition,
  data: DocxTemplateRenderData
): Promise<Uint8Array> {
  const res = await fetch(spec.templateFile);
  if (!res.ok) {
    throw new Error(
      `Failed to load DOCX template (${spec.templateFile}): HTTP ${res.status}`
    );
  }
  const templateBytes = await res.arrayBuffer();

  const zip = new PizZip(templateBytes);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: spec.delimiters,
    parser: dottedParser,
  });
  doc.render(data);

  const out = zip.generate({ type: "arraybuffer", compression: "DEFLATE" });
  return new Uint8Array(out);
}

/** Ensure every required variable resolved to a non-empty value. */
function assertRequired(spec: DocxTemplateDefinition, data: DocxTemplateRenderData): void {
  const missing = (spec.requiredFields || []).filter((variable) => {
    let value: unknown = data;
    for (const key of String(variable).split(".")) {
      if (value == null) return true;
      value = (value as Record<string, unknown>)[key];
    }
    return typeof value !== "string" || value.trim() === "";
  });
  if (missing.length > 0) {
    throw new Error(
      `Cannot generate ${spec.document}: missing required field(s): ${missing.join(", ")}`
    );
  }
}

// ── Plain .docx fallback for non-templated documents ─────────────
// Documents without a shipped Word template (clearance, good moral, etc.)
// still get a downloadable, editable .docx built from the shared layout
// (documentLayouts.ts) — the same content the dynamic PDF renders.
// Optional signature images are embedded (resolved by role from the
// Officials collection) when the signatory has one uploaded.
export async function buildLayoutPlainDocx(
  doc: documentRequestInterface,
  officials: Record<string, string>,
  signatureImages?: Record<string, string>
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const layout = getDocumentLayout(doc.document);
  if (!layout) throw new Error(`No layout configured for: ${doc.document}`);
  return buildLayoutDocxPkg(doc, layout, officials, signatureImages);
}

function layoutBodyText(layout: DocumentLayout, doc: documentRequestInterface): string {
  let body = layout.body;
  for (const field of layout.fields) {
    const value = formatFieldValue(field.key, (doc as unknown as Record<string, unknown>)[field.key], field.format);
    body = body.replace(new RegExp(`\\{${field.key}\\}`, "g"), value || `[${field.label}]`);
  }
  const parts = formatDateParts(doc.dateIssued ?? "");
  if (parts) {
    body = body.replace(/\{dateIssuedDay\}/g, parts.day);
    body = body.replace(/\{dateIssuedMonth\}/g, parts.month);
    body = body.replace(/\{dateIssuedYear\}/g, parts.year);
  }
  return body;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlP(p: { text: string; bold?: boolean; center?: boolean; right?: boolean; italic?: boolean }): string {
  const rPr = [
    p.bold ? "<w:b/>" : "",
    p.italic ? "<w:i/>" : "",
    '<w:sz w:val="22"/><w:szCs w:val="22"/>',
  ].join("");
  const jc = p.center ? '<w:jc w:val="center"/>' : p.right ? '<w:jc w:val="right"/>' : "";
  const pPr = jc || p.bold
    ? `<w:pPr>${jc}${jc || p.bold ? "<w:rPr><w:spacing w:after=\"120\"/></w:rPr>" : ""}</w:pPr>`
    : `<w:pPr><w:spacing w:after="240"/></w:pPr>`;
  return `<w:p>${pPr}<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(p.text)}</w:t></w:r></w:p>`;
}

const EMU_PER_PX = 9525;

/** Build a centered/right drawing paragraph for an embedded signature image. */
function xmlImageParagraph(
  rid: string,
  wPx: number,
  hPx: number,
  align: "right" | "center"
): string {
  const emuW = Math.round(wPx * EMU_PER_PX);
  const emuH = Math.round(hPx * EMU_PER_PX);
  const jc = align === "right" ? '<w:jc w:val="right"/>' : '<w:jc w:val="center"/>';
  return (
    `<w:p><w:pPr>${jc}</w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<wp:extent cx="${emuW}" cy="${emuH}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="1" name="Signature"/><wp:cNvGraphicFramePr/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="1" name="Signature"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emuW}" cy="${emuH}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></w:drawing></w:r></w:p>`
  );
}

/** Fetch a signature image, returning { bytes, ext, w, h } or null on failure. */
async function fetchSignatureImage(
  url: string
): Promise<{ bytes: Uint8Array; ext: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Detect PNG vs JPEG via magic bytes.
    const isPng =
      bytes.length > 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg =
      bytes.length > 2 &&
      bytes[0] === 0xff && bytes[1] === 0xd8;
    let w = 100;
    let h = 30;
    if (isPng && bytes.length > 24) {
      w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
      h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
    } else if (isJpeg && bytes.length > 4) {
      // Walk the JPEG for SOF0/SOF2 to read dimensions.
      let i = 2;
      while (i + 9 < bytes.length) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const marker = bytes[i + 1];
        if (marker >= 0xc0 && marker <= 0xc3) {
          h = (bytes[i + 5] << 8) | bytes[i + 6];
          w = (bytes[i + 7] << 8) | bytes[i + 8];
          break;
        }
        const len = (bytes[i + 2] << 8) | bytes[i + 3];
        i += 2 + len;
      }
    }
    if (w <= 0 || h <= 0) { w = 100; h = 30; }
    return { bytes, ext: isPng ? "png" : "jpeg", w, h };
  } catch {
    return null;
  }
}

async function buildLayoutDocxPkg(
  doc: documentRequestInterface,
  layout: DocumentLayout,
  officials: Record<string, string>,
  signatureImages?: Record<string, string>
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const paras: string[] = [];
  const mediaFiles: { name: string; bytes: Uint8Array }[] = [];
  let ridCounter = 2; // rId1 reserved for the office document

  const pbName = (officials["Punong Barangay"] || "").toUpperCase();
  const prepPos = layout.preparedByPosition;
  const prepName = prepPos ? (officials[prepPos] || "").toUpperCase() : "";

  const addSignatureImage = async (position: string): Promise<void> => {
    const url = signatureImages?.[position];
    if (!url) return;
    const img = await fetchSignatureImage(url);
    if (!img) return;
    const fileName = `image${ridCounter}.${img.ext}`;
    mediaFiles.push({ name: fileName, bytes: img.bytes });
    const rid = `rId${ridCounter}`;
    ridCounter += 1;
    // Scale to a ~120px-wide (or proportional) signature strip.
    const targetW = 120;
    const targetH = Math.max(20, Math.round((targetW / img.w) * img.h));
    paras.push(xmlImageParagraph(rid, targetW, targetH, "right"));
  };

  paras.push(xmlP({ text: layout.title.toUpperCase(), bold: true, center: true }));
  if (doc.documentNumber) paras.push(xmlP({ text: `No. ${doc.documentNumber}`, center: true }));
  paras.push(xmlP({ text: "" }));
  paras.push(xmlP({ text: "TO WHOM IT MAY CONCERN:", bold: true }));
  paras.push(xmlP({ text: "" }));

  for (const paragraph of layoutBodyText(layout, doc).split(/\n{2,}/)) {
    if (!paragraph.trim()) continue;
    paras.push(xmlP({ text: paragraph.trim() }));
  }

  if (layout.sections) {
    for (const section of layout.sections) {
      let sectionText = section.text;
      for (const field of layout.fields) {
        const value = formatFieldValue(field.key, (doc as unknown as Record<string, unknown>)[field.key], field.format);
        sectionText = sectionText.replace(new RegExp(`\\{${field.key}\\}`, "g"), value || `[${field.label}]`);
      }
      const dateParts = formatDateParts(doc.dateIssued ?? "");
      if (dateParts) {
        sectionText = sectionText.replace(/\{dateIssuedDay\}/g, dateParts.day);
        sectionText = sectionText.replace(/\{dateIssuedMonth\}/g, dateParts.month);
        sectionText = sectionText.replace(/\{dateIssuedYear\}/g, dateParts.year);
      }
      paras.push(xmlP({ text: "" }));
      paras.push(xmlP({ text: sectionText }));
    }
  }

  paras.push(xmlP({ text: "" }));
  paras.push(xmlP({ text: "" }));

  if (prepPos && prepName) {
    paras.push(xmlP({ text: `Prepared by:`, right: true }));
    if (signatureImages?.hasOwnProperty(prepPos)) {
      await addSignatureImage(prepPos);
    } else {
      paras.push(xmlP({ text: "" }));
    }
    paras.push(xmlP({ text: prepName, bold: true, right: true }));
    paras.push(xmlP({ text: prepPos, italic: true, right: true }));
    paras.push(xmlP({ text: "" }));
    paras.push(xmlP({ text: "" }));
  }
  paras.push(xmlP({ text: "Certified by:", right: true }));
  if (signatureImages?.hasOwnProperty("Punong Barangay")) {
    await addSignatureImage("Punong Barangay");
  } else {
    paras.push(xmlP({ text: "" }));
  }
  paras.push(xmlP({ text: `${layout.signatoryPrefix ? layout.signatoryPrefix + " " : ""}${pbName}`, bold: true, right: true }));
  paras.push(xmlP({ text: layout.signatoryTitle || "Punong Barangay", italic: true, right: true }));

  const issuedOn = formatDateMDY(doc.dateIssued ?? "");
  paras.push(xmlP({ text: `${issuedOn ? `ISSUED ON: ${issuedOn}` : "ISSUED ON: ____________"}`, right: true }));

  const documentXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${paras.join("")}` +
    `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>` +
    `</w:body></w:document>`;

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    (mediaFiles.some((f) => f.name.endsWith(".png"))
      ? `<Default Extension="png" ContentType="image/png"/>` : "") +
    (mediaFiles.some((f) => f.name.endsWith(".jpeg"))
      ? `<Default Extension="jpeg" ContentType="image/jpeg"/>` : "") +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>` +
    `</Types>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>` +
    `</Relationships>`;

  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    mediaFiles
      .map(
        (f, i) =>
          `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${f.name}"/>`
      )
      .join("") +
    `</Relationships>`;

  const stylesXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
    `</w:styles>`;

  const zip = new PizZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rels);
  zip.file("word/document.xml", documentXml);
  zip.file("word/_rels/document.xml.rels", docRels);
  zip.file("word/styles.xml", stylesXml);
  for (const f of mediaFiles) {
    zip.file(`word/media/${f.name}`, f.bytes);
  }
  const bytes = zip.generate({ type: "arraybuffer", compression: "DEFLATE" });
  return { bytes: new Uint8Array(bytes), fileName: `${layout.title}.docx` };
}

// ── Main builder (mirrors buildDynamicDocumentPDF) ────────────────
export async function buildDynamicDocumentDOCX(
  doc: documentRequestInterface
): Promise<{ bytes: Uint8Array; header: string; snapshot: Record<string, string> }> {
  const spec = await getDocxTemplateSpec(doc.document);
  if (!spec) {
    throw new Error(`No DOCX template configured for: ${doc.document}`);
  }

  const store = useBarangaySettingsStore.getState();
  if (!store.loaded) await store.refresh();
  const s = useBarangaySettingsStore.getState();
  const activeByPosition = s.activeByPosition();
  const rosterByPosition = s.activeOfficialsByPosition();

  const data = buildDocumentData(doc, s.settings ?? undefined, activeByPosition, rosterByPosition);
  assertRequired(spec, data);
  const bytes = await renderDocxTemplate(spec, data);

  const header =
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const snapshot: Record<string, string> = {
    ...activeByPosition,
    dateIssued: new Date().toISOString(),
  };
  return { bytes, header, snapshot };
}

// ── View / download (mirror viewDocumentPDF / generateDocumentPDF) ──
const DOCX_FILE_NAMES: Record<string, string> = {
  certificateOfIndigency: "Certificate of Indigency.docx",
  barangayCertification: "Barangay Certification.docx",
  certificateOfResidency: "Certificate of Residency.docx",
  certificateOfLowIncome: "Certificate of Low Income.docx",
  endorsementLetter: "Endorsement Letter.docx",
  certificateOfFirstTimeJobseeker: "Barangay Certification (FTJ).docx",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ).docx",
  certificationOfTreesCutting: "Certification of Trees Cutting.docx",
  certificateOfAttestation: "Certificate of Attestation.docx",
};

export async function viewDocumentDOCX(doc: documentRequestInterface): Promise<void> {
  const { bytes, header } = await buildDynamicDocumentDOCX(doc);
  // @ts-expect-error — Uint8Array is a valid BlobPart
  const blob = new Blob([bytes], { type: header });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function generateDocumentDOCX(doc: documentRequestInterface): Promise<void> {
  try {
    let bytes: Uint8Array;
    let header: string;
    let snapshot: Record<string, string>;
    let fileName: string;

    if (isDocxTemplated(doc.document)) {
      const built = await buildDynamicDocumentDOCX(doc);
      bytes = built.bytes;
      header = built.header;
      snapshot = built.snapshot;
      fileName = DOCX_FILE_NAMES[doc.document] || `${doc.document}.docx`;
    } else {
      // No Word template: build a plain, editable .docx from the shared layout.
      const store = useBarangaySettingsStore.getState();
      if (!store.loaded) await store.refresh();
      const s = useBarangaySettingsStore.getState();
      const activeByPosition = s.activeByPosition();
      const activeSignatureByPosition = s.activeSignatureByPosition();
      const built = await buildLayoutPlainDocx(doc, activeByPosition, activeSignatureByPosition);
      bytes = built.bytes;
      header = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      snapshot = { ...activeByPosition, dateIssued: new Date().toISOString() };
      fileName = built.fileName;
    }

    // Persist officials snapshot (same as the PDF path)
    if (doc._id) {
      try {
        await axiosInstance.patch(`/document-request/${doc._id}/snapshot`, {
          snapshot,
        });
      } catch {
        // Non-blocking
      }
    }

    // @ts-expect-error — Uint8Array is a valid BlobPart
    const blob = new Blob([bytes], { type: header });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to generate DOCX:", error);
    throw error;
  }
}

// ── DOCX → PDF (final Word-rendered output) ──────────────────────
// The backend converts the rendered .docx through Microsoft Word so the final
// PDF matches the template exactly (headers, anchored logos, watermark) and
// avoid the dynamic renderer's approximations.
const PDF_FILE_NAMES: Record<string, string> = {
  certificateOfIndigency: "Certificate of Indigency.pdf",
  barangayCertification: "Barangay Certification.pdf",
  certificateOfResidency: "Certificate of Residency.pdf",
  certificateOfLowIncome: "Certificate of Low Income.pdf",
  endorsementLetter: "Endorsement Letter.pdf",
  certificateOfFirstTimeJobseeker: "Barangay Certification (FTJ).pdf",
  firstTimeJobseekerOath: "Oath of Undertaking (FTJ).pdf",
  certificationOfTreesCutting: "Certification of Trees Cutting.pdf",
  certificateOfAttestation: "Certificate of Attestation.pdf",
};

async function convertDocumentDOCXToPDF(
  doc: documentRequestInterface
): Promise<{ blob: Blob; fileName: string; snapshot: Record<string, string> }> {
  const { bytes, header, snapshot } = await buildDynamicDocumentDOCX(doc);
  const form = new FormData();
  // @ts-expect-error — Uint8Array is a valid BlobPart
  form.append("file", new Blob([bytes], { type: header }), `${doc.document}.docx`);
  const res = await axiosInstance.post("/document-request/to-pdf", form, {
    responseType: "arraybuffer",
  });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const fileName = PDF_FILE_NAMES[doc.document] || `${doc.document}.pdf`;
  return { blob, fileName, snapshot };
}

export async function viewDocumentPDFFromDOCX(doc: documentRequestInterface): Promise<void> {
  // Document types without a Word template (clearance, good moral, etc.) have
  // no .docx to render, so preview falls back to the dynamic PDF renderer.
  if (!isDocxTemplated(doc.document)) {
    await viewDocumentPDF(doc);
    return;
  }
  const { blob } = await convertDocumentDOCXToPDF(doc);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function generateDocumentPDFFromDOCX(doc: documentRequestInterface): Promise<void> {
  try {
    // No Word template → fall back to the dynamic PDF renderer.
    if (!isDocxTemplated(doc.document)) {
      await generateDocumentPDF(doc);
      return;
    }
    const { blob, fileName, snapshot } = await convertDocumentDOCXToPDF(doc);

    // Persist officials snapshot (same as the DOCX path)
    if (doc._id) {
      try {
        await axiosInstance.patch(`/document-request/${doc._id}/snapshot`, {
          snapshot,
        });
      } catch {
        // Non-blocking
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to generate DOCX PDF:", error);
    throw error;
  }
}