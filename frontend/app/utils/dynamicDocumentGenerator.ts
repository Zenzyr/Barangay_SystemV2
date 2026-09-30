import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  PDFPage,
  PDFFont,
  PDFImage,
} from "pdf-lib";
import { documentRequestInterface } from "@/app/types/documentRequest";
import { getDocumentLayout, DocumentLayout } from "./documentLayouts";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import axiosInstance from "./axios";
import { formatDateParts, formatFieldValue, formatDateMDY } from "./documentFormat";
import { getTemplateSpec } from "./templateSpecs";
import { getTemplates, generateTemplatePDF } from "./templateService";
import { renderPdfByType } from "./documentTemplateService";

import { renderTemplatePDF } from "./templateDocumentRenderer";
import { sanitizeImageUrl } from "./documentImageUrl";

function stripHonorific(name: string): string {
  return name.replace(/^HON\.\s*/i, "").trim();
}

// ── Template-exact sans font embedding ────────────────────────────
// The reference documents are set in Liberation Sans; StandardFonts.Helvetica
// differs in advance widths (/encode differences) that make long lines drift
// past the reference. Embed the open-licensed Liberation Sans TTFs (metric
// twins of Arial) so template documents lay out 1:1 with the originals.
async function embedSansFonts(pdfDoc: PDFDocument): Promise<{
  fontHelvetica: PDFFont;
  fontHelveticaBold?: PDFFont;
  fontHelveticaItalic?: PDFFont;
}> {
  try {
    // Server-only: reads the open-licensed Liberation Sans TTFs from the public
    // assets dir. In the browser this import throws and we fall back to the
    // standard Helvetica (viewers substitute a metric-compatible Arial).
    const fsNode = await import("node:" + "fs");
    const pathNode = await import("node:" + "path");
    const fontkit = (await import("@pdf-lib/fontkit")).default;
    const base =
      typeof process !== "undefined" && process.cwd()
        ? pathNode.join(process.cwd(), "public", "assets", "document-template", "fonts")
        : "";
    const load = (file: string) => fsNode.readFileSync(pathNode.join(base, file));
    pdfDoc.registerFontkit(fontkit);
    return {
      fontHelvetica: await pdfDoc.embedFont(load("LiberationSans-Regular.ttf")),
      fontHelveticaBold: await pdfDoc.embedFont(load("LiberationSans-Bold.ttf")),
      fontHelveticaItalic: await pdfDoc.embedFont(load("LiberationSans-Italic.ttf")),
    };
  } catch {
    const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    return { fontHelvetica };
  }
}

// ── Page constants ────────────────────────────────────────────────
const PAGE_W = 612; // Letter width
const PAGE_H = 792; // Letter height
const DEFAULT_MARGIN = 60;
const DEFAULT_LOGO_URL = "/assets/logo.jpg";
const DEFAULT_SEAL_URL = "";

// Legacy certificate layout (mirrors barangay_system `certificates/print.php`).
const LEGACY_LOGO_SIZE = 54; // ~0.75in
const LEGACY_SIDEBAR_W = 130; // ~1.8in officials roster column
const LEGACY_SIDEBAR_GAP = 18; // ~0.25in gap between sidebar and content

// ── Layout text engine ────────────────────────────────────────────
/**
 * Builds the full body text of a layout by inserting field values into
 * the template string using {fieldKey} placeholders. Also provides
 * special placeholders for formatted date parts.
 */
function resolveBodyText(
  layout: DocumentLayout,
  doc: documentRequestInterface
): string {
  let body = layout.body;

  // Replace {fieldKey} with the actual value
  for (const field of layout.fields) {
    const value = formatFieldValue(field.key, doc[field.key as keyof documentRequestInterface], field.format);
    const regex = new RegExp(`\\{${field.key}\\}`, "g");
    body = body.replace(regex, value || `[${field.label}]`);
  }

  // Special date parts for dateIssued
  const parts = formatDateParts(doc.dateIssued ?? "");
  if (parts) {
    body = body.replace(/\{dateIssuedDay\}/g, parts.day);
    body = body.replace(/\{dateIssuedMonth\}/g, parts.month);
    body = body.replace(/\{dateIssuedYear\}/g, parts.year);
  }

  return body;
}

/**
 * Wraps text to fit within the given width. Returns an array of lines.
 */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }

    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, fontSize);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

// ── Drawing functions ─────────────────────────────────────────────
interface DrawContext {
  page: PDFPage;
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  fontItalic: PDFFont;
  margin: { left: number; right: number; top: number; bottom: number };
  y: number; // current Y position (flows down)
}

function drawTextLine(ctx: DrawContext, text: string, options: {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: ReturnType<typeof rgb>;
  align?: "left" | "center" | "right" | "justify";
  maxWidth?: number;
  lineHeight?: number;
  indent?: number;
} = {}): number {
  const {
    fontSize = 11,
    bold = false,
    italic = false,
    color = rgb(0, 0, 0),
    align = "left",
    maxWidth,
    lineHeight = 1.5,
    indent = 0,
  } = options;

  const font = bold ? ctx.fontBold : italic ? ctx.fontItalic : ctx.font;
  const textMaxW = maxWidth ?? (PAGE_W - ctx.margin.left - ctx.margin.right - indent);
  const lines = wrapText(text, font, fontSize, textMaxW);
  const lineH = fontSize * lineHeight;

  for (const line of lines) {
    if (ctx.y < ctx.margin.bottom) break;

    const textW = font.widthOfTextAtSize(line, fontSize);
    let x = ctx.margin.left + indent;

    if (align === "center") {
      x = ctx.margin.left + (PAGE_W - ctx.margin.left - ctx.margin.right) / 2 - textW / 2;
    } else if (align === "right") {
      x = PAGE_W - ctx.margin.right - textW;
    }

    ctx.page.drawText(line, {
      x,
      y: ctx.y,
      size: fontSize,
      font,
      color,
    });

    ctx.y -= lineH;
  }

  return ctx.y;
}

function drawHorizontalLine(ctx: DrawContext, y?: number): void {
  const yPos = y ?? ctx.y;
  ctx.page.drawLine({
    start: { x: ctx.margin.left, y: yPos },
    end: { x: PAGE_W - ctx.margin.right, y: yPos },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
}

function drawSectionSeparator(ctx: DrawContext): void {
  ctx.y -= 10;
}

// ── Signature block (official "Certified by:" layout) ────────────
interface SignatoryOptions {
  signatoryTitle?: string;
  signatoryPrefix?: string;
  preparedByPosition?: string;
  signatureImages?: Record<string, string>;
}

/**
 * Signature blocks constrained to a content column (used by the legacy
 * sidebar layout, where the signatories must stay inside the right column
 * instead of spanning the full page width).
 * Also embeds the official's signature image if one is uploaded.
 */
async function drawContentSignatures(
  ctx: DrawContext,
  content: { x: number; w: number },
  officialNames: Record<string, string>,
  options: SignatoryOptions
): Promise<void> {
  const currentY = ctx.y;
  const sigY = currentY - 40;
  const blockW = 150;
  const { signatoryTitle = "Punong Barangay", signatoryPrefix = "", preparedByPosition, signatureImages = {} } = options;
  const normalizedNames: Record<string, string> = {};
  for (const [pos, name] of Object.entries(officialNames)) {
    normalizedNames[pos] = stripHonorific(name);
  }

  // "Prepared by:" — secondary signatory on the left of the column
  if (preparedByPosition) {
    const prepName = normalizedNames[preparedByPosition] || "";
    if (prepName) {
      const bx = content.x;
      const cx = bx + blockW / 2;
      ctx.page.drawText("Prepared by:", {
        x: bx,
        y: sigY,
        size: 10,
        font: ctx.font,
        color: rgb(0, 0, 0),
      });
      ctx.page.drawLine({
        start: { x: bx, y: sigY - 8 },
        end: { x: bx + blockW, y: sigY - 8 },
        thickness: 0.8,
        color: rgb(0, 0, 0),
      });

      const prepSigUrl = signatureImages[preparedByPosition];
      if (prepSigUrl) {
        try {
          const sigRes = await fetch(prepSigUrl);
          if (sigRes.ok) {
            const sigBytes = await sigRes.arrayBuffer();
            let sigImg: PDFImage | undefined;
            try { sigImg = await ctx.doc.embedPng(sigBytes); } catch { sigImg = await ctx.doc.embedJpg(sigBytes); }
            if (sigImg) {
              const targetH = 16;
              const aspect = sigImg.width / sigImg.height;
              const sw = targetH * aspect;
              const sh = targetH;
              ctx.page.drawImage(sigImg, {
                x: cx - sw / 2,
                y: sigY - 8 - sh,
                width: sw,
                height: sh,
              });
            }
          }
        } catch {
          // non-blocking
        }
      }

      const prepDisplay = `${signatoryPrefix ? signatoryPrefix + " " : ""}${prepName.toUpperCase()}`;
      const prepNameW = ctx.fontBold.widthOfTextAtSize(prepDisplay, 10);
      ctx.page.drawText(prepDisplay, {
        x: cx - prepNameW / 2,
        y: sigY - 22,
        size: 10,
        font: ctx.fontBold,
        color: rgb(0, 0, 0),
      });

      const captionW = ctx.font.widthOfTextAtSize(preparedByPosition, 10);
      ctx.page.drawText(preparedByPosition, {
        x: cx - captionW / 2,
        y: sigY - 35,
        size: 10,
        font: ctx.font,
        color: rgb(0, 0, 0),
      });
    }
  }

  // "Certified by:" — Punong Barangay, right-aligned within the column
  const pbName = normalizedNames["Punong Barangay"] || "";
  if (pbName) {
    const bx = content.x + content.w - blockW;
    const cx = bx + blockW / 2;

    ctx.page.drawText("Certified by:", {
      x: bx,
      y: sigY,
      size: 10,
      font: ctx.font,
      color: rgb(0, 0, 0),
    });

    ctx.page.drawLine({
      start: { x: bx, y: sigY - 8 },
      end: { x: bx + blockW, y: sigY - 8 },
      thickness: 0.8,
      color: rgb(0, 0, 0),
    });

    const pbSigUrl = signatureImages["Punong Barangay"];
    if (pbSigUrl) {
      try {
        const sigRes = await fetch(pbSigUrl);
        if (sigRes.ok) {
          const sigBytes = await sigRes.arrayBuffer();
          let sigImg: PDFImage | undefined;
          try { sigImg = await ctx.doc.embedPng(sigBytes); } catch { sigImg = await ctx.doc.embedJpg(sigBytes); }
          if (sigImg) {
            const targetH = 16;
            const aspect = sigImg.width / sigImg.height;
            const sw = targetH * aspect;
            const sh = targetH;
            ctx.page.drawImage(sigImg, {
              x: cx - sw / 2,
              y: sigY - 8 - sh,
              width: sw,
              height: sh,
            });
          }
        }
      } catch {
        // non-blocking
      }
    }

    const displayName = `${signatoryPrefix ? signatoryPrefix + " " : ""}${pbName.toUpperCase()}`;
    const nameW = ctx.fontBold.widthOfTextAtSize(displayName, 10);
    ctx.page.drawText(displayName, {
      x: cx - nameW / 2,
      y: sigY - 22,
      size: 10,
      font: ctx.fontBold,
      color: rgb(0, 0, 0),
    });

    const titleW = ctx.font.widthOfTextAtSize(signatoryTitle, 10);
    ctx.page.drawText(signatoryTitle, {
      x: cx - titleW / 2,
      y: sigY - 35,
      size: 10,
      font: ctx.font,
      color: rgb(0, 0, 0),
    });
  }

  ctx.y = sigY - 50;
}

// ── Main generator ────────────────────────────────────────────────
export async function buildDynamicDocumentPDF(doc: documentRequestInterface): Promise<{
  bytes: Uint8Array;
  snapshot: Record<string, string>;
}> {
  // 1. New tiptap DocumentTemplate (admin-edited in the PDF template builder).
  //    Renders server-side by matching the active template to the request's
  //    document type; falls through to the legacy system when none is bound.
  if (doc._id) {
    const bytes = await renderPdfByType(doc._id);
    if (bytes) {
      return {
        bytes,
        snapshot: {
          type: "db-generated",
          dateIssued: new Date().toISOString(),
        },
      };
    }
  }

  // 2. Legacy DB-driven Template (certificate-templates)
  const templates = await getTemplates();
  const dbTemplate = templates.find((t) => t.documentType === doc.document);
  
  if (dbTemplate && doc._id) {
    // Use Backend Generator
    const blob = await generateTemplatePDF(dbTemplate._id, doc._id);
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return { 
        bytes, 
        snapshot: { 
            type: "db-generated",
            dateIssued: new Date().toISOString() 
        } 
    };
  }

  const layout = getDocumentLayout(doc.document);
  if (!layout) throw new Error(`Unknown document type: ${doc.document}`);

  // Load barangay settings
  const store = useBarangaySettingsStore.getState();
  if (!store.loaded) await store.refresh();
  const s = useBarangaySettingsStore.getState();
  const activeByPosition = s.activeByPosition();
  const activeOfficialsByPosition = s.activeOfficialsByPosition();
  const activeSignatureByPosition = s.activeSignatureByPosition();

  const settings = s.settings;
  const barangay = settings?.barangay;
  const docSettings = settings?.documents;
  const template = docSettings?.templates?.[doc.document];

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

  // ── Template-exact documents (1:1 reproduction of the official PDFs) ──
  const spec = getTemplateSpec(doc.document);
  if (spec) {
    const { fontHelvetica, fontHelveticaBold, fontHelveticaItalic } = await embedSansFonts(pdfDoc);
    await renderTemplatePDF(spec, doc, {
      pdfDoc,
      font,
      fontBold,
      fontItalic,
      fontHelvetica,
      fontHelveticaBold,
      fontHelveticaItalic,
      settings: s.settings ?? undefined,
      officials: activeByPosition,
      officialsByPosition: activeOfficialsByPosition,
      signatureImages: activeSignatureByPosition,
    });

    const snapshot: Record<string, string> = {
      ...activeByPosition,
      dateIssued: new Date().toISOString(),
    };

    const bytes = await pdfDoc.save();
    return { bytes, snapshot };
  }

  const margin = {
    left: template?.marginLeft ?? DEFAULT_MARGIN,
    right: template?.marginRight ?? DEFAULT_MARGIN,
    top: template?.marginTop ?? DEFAULT_MARGIN,
    bottom: template?.marginBottom ?? DEFAULT_MARGIN + 30,
  };

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  // ── Load optional background ──────────────────────────────
  const bgRaw = template?.backgroundUrl;
  const bgUrl = sanitizeImageUrl(bgRaw);
  if (bgRaw?.trim() && !bgUrl) {
    console.warn(
      `[dynamic-doc] documents.templates["${doc.document}"].backgroundUrl is not a valid image URL (${JSON.stringify(bgRaw.trim())}); skipping background`
    );
  }
  if (bgUrl) {
    try {
      const bgRes = await fetch(bgUrl);
      if (bgRes.ok) {
        const bgBytes = await bgRes.arrayBuffer();
        let bgImage: PDFImage | undefined;
        try { bgImage = await pdfDoc.embedPng(bgBytes); } catch { bgImage = await pdfDoc.embedJpg(bgBytes); }
        if (bgImage) {
          page.drawImage(bgImage, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
        }
      } else {
        console.warn(`[dynamic-doc] background fetch failed (${bgUrl}): HTTP ${bgRes.status}`);
      }
    } catch (e) {
      console.warn(`[dynamic-doc] background fetch failed (${bgUrl}):`, e);
    }
  }

  // ── Load optional logo ──────────────────────────────────
  let logoImage: PDFImage | undefined;
  const logoRaw = docSettings?.logoUrl || barangay?.logoUrl || DEFAULT_LOGO_URL;
  const logoUrl = sanitizeImageUrl(logoRaw);
  if (logoRaw?.trim() && logoUrl === undefined && logoRaw !== DEFAULT_LOGO_URL) {
    console.warn(
      `[dynamic-doc] logoUrl is not a valid image URL (${JSON.stringify(logoRaw.trim())}); using default ${DEFAULT_LOGO_URL}`
    );
  }
  if (logoUrl) {
    try {
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        const logoBytes = await logoRes.arrayBuffer();
        try {
          logoImage = await pdfDoc.embedPng(logoBytes);
        } catch {
          logoImage = await pdfDoc.embedJpg(logoBytes);
        }
      } else {
        console.warn(`[dynamic-doc] logo fetch failed (${logoUrl}): HTTP ${logoRes.status}`);
      }
    } catch (e) {
      console.warn(`[dynamic-doc] logo fetch failed (${logoUrl}):`, e);
    }
  }

  // ── Load optional seal ──────────────────────────────────
  let sealImage: PDFImage | undefined;
  const sealRaw = docSettings?.sealUrl || barangay?.sealUrl || DEFAULT_SEAL_URL;
  const sealUrl = sanitizeImageUrl(sealRaw);
  if (sealRaw?.trim() && sealUrl === undefined) {
    console.warn(
      `[dynamic-doc] sealUrl is not a valid image URL (${JSON.stringify(sealRaw.trim())}); skipping seal`
    );
  }
  if (sealUrl) {
    try {
      const sealRes = await fetch(sealUrl);
      if (sealRes.ok) {
        const sealBytes = await sealRes.arrayBuffer();
        try {
          sealImage = await pdfDoc.embedPng(sealBytes);
        } catch {
          sealImage = await pdfDoc.embedJpg(sealBytes);
        }
      } else {
        console.warn(`[dynamic-doc] seal fetch failed (${sealUrl}): HTTP ${sealRes.status}`);
      }
    } catch (e) {
      console.warn(`[dynamic-doc] seal fetch failed (${sealUrl}):`, e);
    }
  }

  // ── Draw header (dual logos + official letterhead) ──────────────
  const y = PAGE_H - margin.top;

  const ctx: DrawContext = {
    page,
    doc: pdfDoc,
    font,
    fontBold,
    fontItalic,
    margin,
    y,
  };

  // Dual logos — one in each top corner (mirrors barangay_system print.php)
  if (logoImage) {
    const logoW = Math.min(LEGACY_LOGO_SIZE, logoImage.width);
    const logoScale = logoW / logoImage.width;
    const logoH = logoImage.height * logoScale;
    const logoTop = PAGE_H - margin.top;
    page.drawImage(logoImage, {
      x: margin.left,
      y: logoTop - logoH,
      width: logoW,
      height: logoH,
    });
    page.drawImage(logoImage, {
      x: PAGE_W - margin.right - logoW,
      y: logoTop - logoH,
      width: logoW,
      height: logoH,
    });
  }

  const barangayName = barangay?.name || "Barangay Rabon";
  const municipality = barangay?.municipality || "Rosario";
  const province = barangay?.province || "La Union";

  // Centered letterhead
  drawTextLine(ctx, "Republic of the Philippines", {
    fontSize: 13,
    bold: true,
    align: "center",
  });
  drawTextLine(ctx, `Province of ${province}`, {
    fontSize: 11,
    align: "center",
  });
  drawTextLine(ctx, `Municipality of ${municipality}`, {
    fontSize: 11,
    align: "center",
  });
  drawTextLine(ctx, barangayName, {
    fontSize: 11,
    align: "center",
  });
  drawTextLine(ctx, "Office of the Punong Barangay", {
    fontSize: 12,
    bold: true,
    align: "center",
  });

  drawSectionSeparator(ctx);
  drawHorizontalLine(ctx);
  ctx.y -= 6;

  // ── Two-column body: officials sidebar (left) + content (right) ──
  const mainTopY = ctx.y;
  const sidebarRight = margin.left + LEGACY_SIDEBAR_W;
  const contentX = sidebarRight + LEGACY_SIDEBAR_GAP;
  const contentW = PAGE_W - margin.right - contentX;

  // Officials roster sidebar (same structure as barangay_system print.php)
  {
    const sx = margin.left + 4;
    const innerW = sidebarRight - sx - 2;
    let sy = mainTopY;
    const entry = (text: string, o: { bold?: boolean; italic?: boolean; size?: number } = {}) => {
      if (!text) return;
      const f = o.bold ? fontBold : o.italic ? fontItalic : font;
      let size = o.size ?? 9.5;
      while (size > 6.5 && f.widthOfTextAtSize(text, size) > innerW) size -= 0.5;
      page.drawText(text, { x: sx, y: sy, size, font: f, color: rgb(0, 0, 0) });
      sy -= 13;
    };

    const pbName = activeByPosition["Punong Barangay"];
    entry(pbName ? pbName.toUpperCase() : "______________________", { bold: true });
    entry("Punong Barangay", { italic: true, size: 8.5 });
    sy -= 3;

    entry("SANGGUNIANG BARANGAY", { bold: true, size: 8.5 });
    entry("Member", { italic: true, size: 8.5 });
    const kagawads = activeOfficialsByPosition["Barangay Kagawad"] ?? [];
    for (let i = 0; i < 6; i++) {
      entry(kagawads[i] || "______________________", { size: 9 });
    }
    sy -= 3;

    const skName = activeByPosition["SK Chairperson"];
    entry(skName ? skName.toUpperCase() : "______________________", { bold: true, size: 8.5 });
    entry("SK Chairperson", { italic: true, size: 8.5 });
    sy -= 3;

    const treasurer = activeByPosition["Barangay Treasurer"];
    entry(treasurer ? treasurer.toUpperCase() : "______________________", { bold: true, size: 8.5 });
    entry("Barangay Treasurer", { italic: true, size: 8.5 });
    sy -= 3;

    const secretary = activeByPosition["Barangay Secretary"];
    entry(secretary ? secretary.toUpperCase() : "______________________", { bold: true, size: 8.5 });
    entry("Barangay Secretary", { italic: true, size: 8.5 });
  }

  // Content flows within the right column only
  ctx.y = mainTopY;
  ctx.margin = { ...margin };
  ctx.margin.left = contentX;
  ctx.margin.right = PAGE_W - contentX - contentW;

  // ── Document title ──────────────────────────────────────────────
  const title = layout.title.toUpperCase();
  drawTextLine(ctx, title, {
    fontSize: 13,
    bold: true,
    align: "center",
  });

  ctx.y -= 4;

  // Certificate number if applicable
  if (doc.documentNumber) {
    drawTextLine(ctx, `No. ${doc.documentNumber}`, {
      fontSize: 10,
      align: "center",
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  drawSectionSeparator(ctx);

  // ── "TO WHOM IT MAY CONCERN:" ──────────────────────────────────
  drawTextLine(ctx, "TO WHOM IT MAY CONCERN:", {
    fontSize: 11,
    bold: true,
    align: "left",
  });

  drawSectionSeparator(ctx);

  // ── Body text (split into paragraphs, justified) ────────────────
  const bodyText = resolveBodyText(layout, doc);
  const paragraphs = bodyText.split(/\n{2,}/);
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) continue;
    drawTextLine(ctx, paragraph.trim(), {
      fontSize: 11,
      align: "justify",
      lineHeight: 1.5,
    });
    ctx.y -= 8;
  }

  // ── Additional sections ─────────────────────────────────────────
  if (layout.sections) {
    for (const section of layout.sections) {
      drawSectionSeparator(ctx);

      let sectionText = section.text;
      // Resolve field values in section text
      for (const field of layout.fields) {
        const value = formatFieldValue(field.key, doc[field.key as keyof documentRequestInterface], field.format);
        sectionText = sectionText.replace(
          new RegExp(`\\{${field.key}\\}`, "g"),
          value || `[${field.label}]`
        );
      }
      // Date parts
      const dateParts = formatDateParts(doc.dateIssued ?? "");
      if (dateParts) {
        sectionText = sectionText.replace(/\{dateIssuedDay\}/g, dateParts.day);
        sectionText = sectionText.replace(/\{dateIssuedMonth\}/g, dateParts.month);
        sectionText = sectionText.replace(/\{dateIssuedYear\}/g, dateParts.year);
      }
      // Barangay info placeholders
      sectionText = sectionText.replace(/\{barangayName\}/g, barangayName);
      sectionText = sectionText.replace(/\{barangayMunicipality\}/g, barangay?.municipality || "");
      sectionText = sectionText.replace(/\{barangayProvince\}/g, barangay?.province || "");

      drawTextLine(ctx, sectionText, {
        fontSize: 11,
        align: "justify",
        lineHeight: 1.6,
      });
    }
  }

  // ── Draw seal (if available, centered between text and signatures)
  if (sealImage) {
    const sealW = Math.min(80, sealImage.width);
    const sealScale = sealW / sealImage.width;
    const sealH = sealImage.height * sealScale;
    const sealX = contentX + contentW / 2 - sealW / 2;

    ctx.y -= 10;
    page.drawImage(sealImage, {
      x: sealX,
      y: ctx.y - sealH,
      width: sealW,
      height: sealH,
    });
    ctx.y -= sealH + 10;
  }

  // ── Signatures ──────────────────────────────────────────────────
  await drawContentSignatures(ctx, { x: contentX, w: contentW }, activeByPosition, {
    signatoryTitle: layout.signatoryTitle || docSettings?.signatoryTitle || "Punong Barangay",
    signatoryPrefix: layout.signatoryPrefix,
    preparedByPosition: layout.preparedByPosition,
    signatureImages: activeSignatureByPosition,
  });

  // ── Footer + sidebar border (RES. CERT. NO / ISSUED ON / ISSUED AT) ──
  const footerTop = margin.bottom - 10;
  page.drawLine({
    start: { x: sidebarRight, y: mainTopY },
    end: { x: sidebarRight, y: footerTop },
    thickness: 1,
    color: rgb(0, 0, 0),
  });
  page.drawLine({
    start: { x: margin.left, y: footerTop },
    end: { x: PAGE_W - margin.right, y: footerTop },
    thickness: 0.6,
    color: rgb(0.5, 0.5, 0.5),
  });

  const certNo = doc.documentNumber ? `${doc.documentNumber}` : "____________________";
  page.drawText(`RES. CERT. NO. ${certNo}`, {
    x: margin.left,
    y: footerTop - 14,
    size: 9.5,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  page.drawText(`ISSUED ON: ${formatDateMDY(doc.dateIssued ?? "") || "____________"}`, {
    x: margin.left,
    y: footerTop - 26,
    size: 9.5,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText(`ISSUED AT: ${barangayName}, ${municipality}, ${province}`, {
    x: margin.left,
    y: footerTop - 38,
    size: 9.5,
    font,
    color: rgb(0, 0, 0),
  });

  // ── Officials snapshot ──────────────────────────────────────────
  const snapshot: Record<string, string> = {
    ...activeByPosition,
    dateIssued: new Date().toISOString(),
  };

  const bytes = await pdfDoc.save();
  return { bytes, snapshot };
}

// ── Watermark ─────────────────────────────────────────────────────
interface ResidentNameFields {
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

function requesterName(doc: documentRequestInterface): string {
  const residentName =
    doc.resident &&
    typeof doc.resident === "object" &&
    ((doc.resident as ResidentNameFields).fullName ||
      ((doc.resident as ResidentNameFields).firstName &&
        `${(doc.resident as ResidentNameFields).firstName} ${(doc.resident as ResidentNameFields).lastName || ""}`.trim()));
  return residentName || doc.fullName || "PREVIEW";
}

async function watermarkDocumentPDF(
  pdfBytes: Uint8Array,
  name: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const gray = rgb(0.72, 0.72, 0.72);
  const size = 28;
  const text = `${name} \u00B7 PREVIEW`;

  for (const page of pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const stepX = width / 2;
    const stepY = height / 2;
    const textW = font.widthOfTextAtSize(text, size) * 1.6;

    for (let y = -height; y < height * 1.5; y += stepY) {
      for (let x = -width; x < width * 1.5; x += stepX) {
        page.drawText(text, {
          x: x + width / 2 - textW / 2,
          y: y + height / 2,
          size,
          font,
          color: gray,
          rotate: degrees(35),
        });
      }
    }
  }

  return pdfDoc.save();
}

// ── PUBLIC API (same signatures as before) ────────────────────────
const DOCUMENT_NAMES: Record<string, string> = {
  barangayCertificate: "Barangay Certification",
  barangayClearance: "Barangay Certificate",
  certificateOfResidency: "Barangay Certificate of Residency",
  certificateOfIndigency: "Certificate of Indigency",
  barangayBusinessClearance: "Barangay Business Clearance",
  certificateOfAttestation: "Certificate of Attestation",
  certificationOfTreesCutting: "Certification of Trees Cutting",
  barangayCertification: "Barangay Certification",
  certificateOfFirstTimeJobseeker: "Barangay Certification (First-Time Jobseeker)",
  certificateOfLowIncome: "Certificate of Low Income",
  endorsementLetter: "Endorsement Letter",
};

export async function viewDocumentPDF(doc: documentRequestInterface): Promise<void> {
  const { bytes } = await buildDynamicDocumentPDF(doc);
  const watermarked = await watermarkDocumentPDF(bytes, requesterName(doc));

  const fileName = `${DOCUMENT_NAMES[doc.document] || doc.document}.pdf`;
  const blob = new Blob([watermarked as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function generateDocumentPDF(doc: documentRequestInterface): Promise<void> {
  try {
    const { bytes, snapshot } = await buildDynamicDocumentPDF(doc);

    // Persist officials snapshot
    if (doc._id) {
      try {
        await axiosInstance.patch(`/document-request/${doc._id}/snapshot`, {
          snapshot,
        });
      } catch {
        // Non-blocking
      }
    }

    // Download
    const fileName = `${DOCUMENT_NAMES[doc.document] || doc.document}.pdf`;
    const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    throw error;
  }
}
