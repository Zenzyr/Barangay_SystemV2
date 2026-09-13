import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { barangaySettings } from "@/app/types/barangaySettings.type";
import { getDocumentLayout } from "./documentLayouts";
import { formatDateParts, formatFieldValue } from "./documentFormat";
import { TemplateImage, TemplateRosterEntry, TemplateSignature, TemplateSpec } from "./templateSpecs";
import { sanitizeImageUrl } from "./documentImageUrl";

function stripHonorific(name: string): string {
  return name.replace(/^HON\.\s*/i, "").trim();
}

const DEFAULT_LOGO_URL = "/assets/logo.jpg";

function fieldValue(doc: documentRequestInterface, key: string): unknown {
  return (doc as unknown as Record<string, unknown>)[key];
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

async function embedImage(
  pdfDoc: PDFDocument,
  bytes: ArrayBuffer
): Promise<PDFImage | undefined> {
  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    try {
      return await pdfDoc.embedJpg(bytes);
    } catch {
      return undefined;
    }
  }
}

async function fetchImage(url: string): Promise<ArrayBuffer | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return await res.arrayBuffer();
  } catch {
    return undefined;
  }
}

/**
 * Resolve the bytes for a template image slot. A settings-provided override
 * (by role) is preferred; if it is missing or fails to load, fall back to the
 * baked-in template asset so the document still renders.
 */
async function resolveImageBytes(
  img: TemplateImage,
  settings?: barangaySettings,
  docKey?: string
): Promise<ArrayBuffer | undefined> {
  const override = img.role ? resolveImageOverride(img.role, settings, docKey) : undefined;
  if (override) {
    const bytes = await fetchImage(override);
    if (bytes) return bytes;
    console.warn(
      `[document-template] settings override for role "${img.role}" failed to load (${override}); falling back to baked-in asset ${img.asset}`
    );
  }
  return fetchImage(img.asset);
}

/**
 * Map a template image "role" to a settings-provided URL, so a barangay
 * can swap the baked-in template artwork for its own. The built-in logo
 * default (`/assets/logo.jpg`) is treated as "not configured" so template
 * parity is preserved out of the box.
 */
function resolveImageOverride(
  role: string,
  settings?: barangaySettings,
  docKey?: string
): string | undefined {
  const docSettings = settings?.documents;
  const template = docKey ? docSettings?.templates?.[docKey] : undefined;
  const barangay = settings?.barangay;
  const validate = (raw?: string, label?: string): string | undefined => {
    const clean = sanitizeImageUrl(raw);
    if (raw?.trim() && !clean) {
      console.warn(
        `[document-template] settings override "${label}" is not a valid image URL (${JSON.stringify(raw.trim())}); falling back to baked-in asset`
      );
    }
    return clean;
  };
  if (role === "background") {
    return validate(template?.backgroundUrl, "documents.templates[" + (docKey ?? "") + "].backgroundUrl");
  }
  if (role === "seal") {
    const seal = docSettings?.sealUrl?.trim() || barangay?.sealUrl?.trim();
    return validate(seal, "sealUrl");
  }
  if (role === "logo") {
    const logo = docSettings?.logoUrl?.trim() || barangay?.logoUrl?.trim();
    if (!logo || logo === DEFAULT_LOGO_URL) return undefined;
    return validate(logo, "logoUrl");
  }
  return undefined;
}

function resolveText(
  text: string,
  doc: documentRequestInterface,
  settings?: barangaySettings
): string {
  let out = text;
  const layout = getDocumentLayout(doc.document);
  const fieldMap = new Map<string, string>();
  for (const field of layout?.fields ?? []) {
    const value = formatFieldValue(field.key, fieldValue(doc, field.key), field.format);
    fieldMap.set(field.key, value);
  }
  // date parts for dateIssued
  const parts = formatDateParts(doc.dateIssued ?? "");
  if (parts) {
    fieldMap.set("dateIssuedDay", parts.day);
    fieldMap.set("dateIssuedMonth", parts.month);
    fieldMap.set("dateIssuedYear", parts.year);
  }
  const barangayName = settings?.barangay?.name || "Barangay Rabon";
  const municipality = settings?.barangay?.municipality || "Rosario";
  const province = settings?.barangay?.province || "La Union";
  fieldMap.set("barangayName", barangayName);
  fieldMap.set("barangayMunicipality", municipality);
  fieldMap.set("barangayProvince", province);

  for (const [key, value] of fieldMap) {
    out = out.split(`{${key}}`).join(value || "");
  }
  return out;
}

export interface TemplateRenderOptions {
  pdfDoc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
  fontHelvetica: PDFFont;
  /** Optional bold/italic cut of the sans face (embedding the reference font). */
  fontHelveticaBold?: PDFFont;
  fontHelveticaItalic?: PDFFont;
  settings?: barangaySettings;
  officials: Record<string, string>;
  /** Active official names grouped by position, precedence-sorted. Used by the officials roster. */
  officialsByPosition?: Record<string, string[]>;
  /** Active official signature image URLs by position (resolved from Officials collection). */
  signatureImages?: Record<string, string>;
}

/**
 * Resolve the name drawn in a roster slot. A static entry is drawn verbatim;
 * an official entry looks up the active name by position (optionally picking
 * the Nth holder by precedence for multi-holder positions like Kagawad).
 */
function rosterName(
  entry: TemplateRosterEntry,
  officials: Record<string, string>,
  officialsByPosition?: Record<string, string[]>
): string {
  if (entry.static) return entry.static;
  if (!entry.position) return "";
  if (entry.index !== undefined) {
    const names = officialsByPosition?.[entry.position] ?? [];
    return names[entry.index] ?? "";
  }
  return officials[entry.position] ?? "";
}

function drawSignatureBlock(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: {
    font: PDFFont;
    fontBold: PDFFont;
    fontItalic: PDFFont;
    fontHelvetica: PDFFont;
    fontHelveticaBold?: PDFFont;
    fontHelveticaItalic?: PDFFont;
  },
  sig: TemplateSignature,
  officialName: string
): void {
  const isHelvetica = sig.font === "helvetica";
  const base = isHelvetica ? fonts.fontHelvetica : fonts.font;
  const baseBold = isHelvetica ? fonts.fontHelveticaBold ?? fonts.fontHelvetica : fonts.fontBold;
  const font = (label: string, italic?: boolean) =>
    italic ? (isHelvetica ? fonts.fontHelveticaItalic ?? base : fonts.fontItalic) : base;
  if (sig.line) {
    page.drawLine({
      start: { x: sig.line.x1, y: sig.line.y1 },
      end: { x: sig.line.x2, y: sig.line.y2 },
      thickness: 0.8,
      color: rgb(0, 0, 0),
    });
  }
  if (sig.label) {
    page.drawText(sig.label, {
      x: sig.labelX,
      y: sig.labelY,
      size: sig.labelSize,
      font: font(sig.label, sig.labelItalic),
      color: rgb(0, 0, 0),
    });
  }
  if (officialName) {
    const displayName = `${sig.prefix ? sig.prefix + " " : ""}${officialName.toUpperCase()}`;
    page.drawText(displayName, {
      x: sig.nameX,
      y: sig.nameY,
      size: sig.nameSize,
      font: sig.nameBold ? baseBold : base,
      color: rgb(0, 0, 0),
    });
    page.drawText(sig.titleText || sig.position, {
      x: sig.titleX,
      y: sig.titleY,
      size: sig.titleSize,
      font: base,
      color: rgb(0, 0, 0),
    });
  }
}

export async function renderTemplatePDF(
  spec: TemplateSpec,
  doc: documentRequestInterface,
  opts: TemplateRenderOptions
): Promise<void> {
  const { pdfDoc, font, fontBold, fontItalic, fontHelvetica, fontHelveticaBold, fontHelveticaItalic, settings, officials, officialsByPosition, signatureImages } = opts;
  const page = pdfDoc.addPage(spec.page);

  // ── Images (template assets, overridable per role via settings) ──
  for (const img of spec.images ?? []) {
    const bytes = await resolveImageBytes(img, settings, doc.document);
    if (!bytes) continue;
    try {
      const image = await embedImage(pdfDoc, bytes);
      if (image) page.drawImage(image, { x: img.x, y: img.y, width: img.w, height: img.h });
    } catch {
      // Never let one failing image abort the whole document.
    }
  }

  // ── Shapes (rules, signature lines) ──────────────────────────────
  for (const shape of spec.shapes ?? []) {
    if (shape.type === "rect") {
      page.drawRectangle({ x: shape.x, y: shape.y, width: shape.w, height: shape.h, color: hexToRgb(shape.color) });
    } else {
      page.drawLine({
        start: { x: shape.x1, y: shape.y1 },
        end: { x: shape.x2, y: shape.y2 },
        thickness: shape.thickness ?? 0.5,
        color: hexToRgb(shape.color),
      });
    }
  }

  // ── Fill boxes ───────────────────────────────────────────────────
  for (const box of spec.boxes ?? []) {
    if (box.fill) {
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        color: hexToRgb(box.fill),
        borderColor: box.border ? hexToRgb(box.border) : undefined,
        borderWidth: box.borderWidth ?? (box.border ? 0.5 : 0),
      });
    }
  }

  // ── Anchors (static/placeholder body text) ───────────────────────
  for (const anchor of spec.anchors ?? []) {
    const text = resolveText(anchor.text, doc, settings);
    let anchorFont: PDFFont = font;
    if (anchor.font === "helvetica") {
      anchorFont = anchor.bold ? fontHelveticaBold ?? fontHelvetica : anchor.italic ? fontHelveticaItalic ?? fontHelvetica : fontHelvetica;
    } else {
      anchorFont = anchor.bold ? fontBold : anchor.italic ? fontItalic : font;
    }
    page.drawText(text, { x: anchor.x, y: anchor.y, size: anchor.size, font: anchorFont, color: rgb(0, 0, 0) });
  }

  // ── Box values ───────────────────────────────────────────────────
  for (const box of spec.boxes ?? []) {
    const value = formatFieldValue(box.field, fieldValue(doc, box.field), box.format);
    if (!value) continue;
    const size = box.size ?? 10;
    const padX = box.padX ?? 1.5;
    const baselineOffset = box.baselineOffset ?? 4;
    const valueFont = box.font === "times" ? font : fontHelvetica;
    page.drawText(value, {
      x: box.x + padX,
      y: box.y + baselineOffset,
      size,
      font: valueFont,
      color: rgb(0, 0, 0),
    });
  }

  // ── Officials roster (sidebar) ───────────────────────────────────
  for (const entry of spec.roster ?? []) {
    const name = rosterName(entry, officials, officialsByPosition);
    if (!name) continue;
    const entryFont = entry.bold ? fontBold : entry.italic ? fontItalic : font;
    const display = entry.uppercase ? name.toUpperCase() : name;
    page.drawText(display, { x: entry.x, y: entry.y, size: entry.size, font: entryFont, color: rgb(0, 0, 0) });
  }

  // ── Signature blocks ("Prepared by:" / "Certified by:") ─────────
  for (const sig of spec.signatures ?? (spec.signature ? [spec.signature] : [])) {
    const officialName = stripHonorific(officials[sig.position] || "");
    const sigImageUrl = signatureImages?.[sig.position];

    // Embed signature image if available and coordinates are specified
    if (sigImageUrl && sig.sigImageX !== undefined && sig.sigImageY !== undefined) {
      try {
        const imgRes = await fetch(sigImageUrl);
        if (imgRes.ok) {
          const imgBytes = await imgRes.arrayBuffer();
          let img: PDFImage | undefined;
          try { img = await pdfDoc.embedPng(imgBytes); } catch { img = await pdfDoc.embedJpg(imgBytes); }
          if (img) {
            const targetW = sig.sigImageW ?? 100;
            const targetH = sig.sigImageH ?? 40;
            const aspect = img.width / img.height;
            let drawW = targetW;
            let drawH = targetW / aspect;
            if (drawH > targetH) {
              drawH = targetH;
              drawW = targetH * aspect;
            }
            page.drawImage(img, {
              x: sig.sigImageX,
              y: sig.sigImageY,
              width: drawW,
              height: drawH,
            });
          }
        }
      } catch {
        // Signature image fetch/embed failure is non-blocking
      }
    }

    drawSignatureBlock(pdfDoc, page, { font, fontBold, fontItalic, fontHelvetica, fontHelveticaBold, fontHelveticaItalic }, sig, officialName);
  }

  // ── Footer (settings-only, matches generic generator behavior) ──
  const footerText = settings?.documents?.footerText || settings?.barangay?.footerText || "";
  if (footerText) {
    const footerW = font.widthOfTextAtSize(footerText, 8);
    page.drawText(footerText, {
      x: spec.page[0] / 2 - footerW / 2,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }
}