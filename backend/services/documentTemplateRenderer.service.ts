import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  rgb,
  degrees,
} from "pdf-lib";
import Official from "../model/official.model";
import {
  DocumentTemplateService,
  pageDimensions,
} from "./documentTemplate.service";
import { renderTiptapDocument } from "./tiptapPdfRenderer.service";
import { TiptapNode } from "../utils/tiptapDoc";
import { loadTemplateImage } from "./docTemplateExport.service";

const FONT_MAP: Record<string, Record<string, StandardFonts>> = {
  times: {
    normal: StandardFonts.TimesRoman,
    italic: StandardFonts.TimesRomanItalic,
    bold: StandardFonts.TimesRomanBold,
    bolditalic: StandardFonts.TimesRomanBoldItalic,
  },
  helvetica: {
    normal: StandardFonts.Helvetica,
    italic: StandardFonts.HelveticaOblique,
    bold: StandardFonts.HelveticaBold,
    bolditalic: StandardFonts.HelveticaBoldOblique,
  },
  courier: {
    normal: StandardFonts.Courier,
    italic: StandardFonts.CourierOblique,
    bold: StandardFonts.CourierBold,
    bolditalic: StandardFonts.CourierBoldOblique,
  },
};

function pickFont(
  family: string | undefined,
  bold?: string,
  italic?: string,
): StandardFonts {
  const fam = String(family || "times")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const table =
    FONT_MAP[fam] ||
    (fam === "timesnewroman" || fam === "timesroman" || fam === "serif"
      ? FONT_MAP.times
      : FONT_MAP.times);
  const style = `${bold === "bold" ? "bold" : ""}${italic === "italic" ? "italic" : ""}`;
  return table[style || "normal"] || table.normal;
}

function hexToRgb(hex: string) {
  const clean = String(hex || "#000000").replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full || "000000", 16);
  if (isNaN(num)) return rgb(0, 0, 0);
  return rgb(
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  );
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = String(text || "").split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (para === "") {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let cur = "";
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && cur) {
        lines.push(cur);
        cur = word;
      } else {
        cur = test;
      }
    }
    if (cur !== "") lines.push(cur);
  }
  return lines;
}

async function loadImage(
  doc: PDFDocument,
  source: string,
): Promise<PDFImage | null> {
  if (!source) return null;
  try {
    const local = loadTemplateImage(source);
    if (local && local.type !== "gif") {
      const bytes = new Uint8Array(local.data);
      return local.type === "png"
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
    }
    if (/^data:image\/(png|jpeg|jpg);base64,/i.test(source)) {
      const meta = source.match(/^data:image\/(png|jpeg|jpg);base64,(.*)$/i);
      if (!meta) return null;
      const bytes = Buffer.from(meta[2], "base64");
      return meta[1].toLowerCase().includes("png")
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
    }
    const res = await fetch(source);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const isPng =
      source.toLowerCase().includes(".png") ||
      bytes.subarray(0, 4).toString("hex") === "89504e47";
    return isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export interface RenderTemplateOptions {
  data?: Record<string, any>;
  lenient?: boolean;
}

/**
 * Renders a saved template's element configuration (NOT a hardcoded layout)
 * onto a PDF page. Dynamic fields are resolved from the live Officers +
 * BarangaySettings + the document request data, so officials stay current
 * without editing the template.
 */
export class DocumentTemplateRenderer {
  static async renderPDF(
    templateIdOrType: string,
    opts: RenderTemplateOptions = {},
  ): Promise<Buffer> {
    const template =
      await DocumentTemplateService.getByIdOrType(templateIdOrType);
    if (!template) throw new Error("Template not found");

    if (template.contentFormat === "tiptap" && template.editorContent) {
      return this.renderContentPDF(
        template.editorContent as TiptapNode,
        template.page as any,
        opts.data || {},
      );
    }

    const { width, height } = pageDimensions(template);
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);
    const ctx = await DocumentTemplateService.buildFieldContext(
      opts.data || {},
    );
    const elements = [...(template.elements || [])].sort(
      (a: any, b: any) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
    );

    // Full-bleed page background drawn beneath everything.
    if ((template.page as any).background) {
      const bg = await loadImage(pdfDoc, (template.page as any).background);
      if (bg) {
        const iw = bg.width;
        const ih = bg.height;
        const scale = Math.max(width / iw, height / ih);
        page.drawImage(bg, {
          x: 0,
          y: 0,
          width: iw * scale,
          height: ih * scale,
          opacity: 0.95,
        });
      }
    }

    for (const el of elements as any[]) {
      try {
        await this.renderElement(pdfDoc, page, el, ctx);
      } catch (err) {
        console.error("[TEMPLATE-RENDER element error]", el?.id, err);
      }
    }

    if ((template.page as any).watermark) {
      const wFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      page.drawText(String((template.page as any).watermark), {
        x: 60,
        y: height / 2 - 80,
        size: 40,
        font: wFont,
        color: rgb(0.85, 0.85, 0.85),
        rotate: degrees(-30),
      });
    }

    return Buffer.from(await pdfDoc.save());
  }

  static async renderContentPDF(
    content: TiptapNode,
    pageSetup: {
      size?: string;
      orientation?: string;
      margins?: any;
      background?: string;
      watermark?: string;
    },
    data: Record<string, any>,
  ): Promise<Buffer> {
    const { width, height } = pageDimensions({ page: pageSetup } as any);
    const pdfDoc = await PDFDocument.create();
    const values = await DocumentTemplateService.buildVariableValues(data);
    const m = pageSetup.margins || {};
    await renderTiptapDocument(
      pdfDoc,
      content,
      {
        width,
        height,
        margins: {
          top: m.top ?? 50,
          right: m.right ?? 50,
          bottom: m.bottom ?? 50,
          left: m.left ?? 50,
        },
        background: pageSetup.background || undefined,
        watermarkText: pageSetup.watermark || undefined,
      },
      values,
      loadImage,
    );
    return Buffer.from(await pdfDoc.save());
  }

  private static async renderElement(
    pdfDoc: PDFDocument,
    page: PDFPage,
    el: any,
    ctx: Record<string, any>,
  ) {
    const size = el.fontSize || 11;
    const color = hexToRgb(el.color || "#000000");

    switch (el.type) {
      case "text": {
        const resolved = DocumentTemplateService.resolveTemplateText(
          el.content || "",
          ctx,
        );
        await this.drawText(pdfDoc, page, el, resolved, size, color);
        break;
      }
      case "dynamicText": {
        const value = el.field
          ? DocumentTemplateService.getDot(ctx, el.field)
          : "";
        await this.drawText(
          pdfDoc,
          page,
          el,
          value === undefined ? "" : String(value),
          size,
          color,
        );
        break;
      }
      case "image": {
        const img = await loadImage(pdfDoc, el.source || "");
        if (!img) {
          this.drawBox(page, el.x, el.y, el.width, el.height, "#cccccc");
          return;
        }
        const fit = el.imageFit || "contain";
        let w = el.width,
          h = el.height;
        const iw = img.width,
          ih = img.height;
        if (fit === "contain" || fit === "cover") {
          const scale = Math.min(w / iw, h / ih);
          w = iw * scale;
          h = ih * scale;
          if (fit === "cover") {
            const s2 = Math.max(el.width / iw, el.height / ih);
            w = iw * s2;
            h = ih * s2;
          }
        }
        page.drawImage(img, { x: el.x, y: el.y, width: w, height: h });
        break;
      }
      case "signature": {
        const position = el.signaturePosition || "Punong Barangay";
        const official = (await Official.findOne({ position, status: "active" })
          .lean()
          .catch(() => null)) as any;
        const signImage = official?.signatureImage || "";
        const name = official?.fullName || ctx.official?.[position] || "";
        if (signImage) {
          const img = await loadImage(pdfDoc, signImage);
          if (img) {
            const scale = Math.min(el.width, el.height * 0.4) / img.width;
            page.drawImage(img, {
              x: el.x + (el.width - img.width * scale) / 2,
              y: el.y + el.height - img.height * scale - 20,
              width: img.width * scale,
              height: img.height * scale,
            });
          }
        }
        const centerX = el.x + el.width / 2;
        const font = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        page.drawLine({
          start: { x: centerX - 70, y: el.y + 26 },
          end: { x: centerX + 70, y: el.y + 26 },
          thickness: 1,
          color: rgb(0, 0, 0),
        });
        const label = name || position;
        page.drawText(label, {
          x: centerX - font.widthOfTextAtSize(label, 11) / 2,
          y: el.y + 10,
          size: 11,
          font,
        });
        break;
      }
      case "line": {
        page.drawLine({
          start: { x: el.x, y: el.y },
          end: { x: el.x + el.width, y: el.y + (el.height || 0) },
          thickness: el.strokeWidth || 1,
          color: hexToRgb(el.strokeColor || "#000000"),
        });
        break;
      }
      case "rect": {
        this.drawBox(
          page,
          el.x,
          el.y,
          el.width,
          el.height,
          el.strokeColor || "#000000",
          el.strokeWidth || 1,
          el.backgroundColor,
        );
        break;
      }
      case "table": {
        const rows: any[] = el.rows || [];
        const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
        const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
        let cy = el.y + el.height;
        for (const row of rows) {
          const label = String(row.label || "");
          const value = DocumentTemplateService.resolveTemplateText(
            String(row.value || ""),
            ctx,
          );
          page.drawText(label, {
            x: el.x,
            y: cy - 12,
            size: 10,
            font: boldFont,
            color: rgb(0, 0, 0),
          });
          page.drawText(value, {
            x: el.x + el.width / 2,
            y: cy - 12,
            size: 10,
            font,
            color: rgb(0, 0, 0),
            maxWidth: el.width / 2,
          });
          page.drawLine({
            start: { x: el.x, y: cy - 4 },
            end: { x: el.x + el.width, y: cy - 4 },
            thickness: 0.5,
            color: rgb(0.7, 0.7, 0.7),
          });
          cy -= 18;
        }
        break;
      }
      default:
        break;
    }
  }

  private static async drawText(
    pdfDoc: PDFDocument,
    page: PDFPage,
    el: any,
    resolved: string,
    size: number,
    color: any,
  ) {
    const fontKey = pickFont(el.fontFamily, el.fontWeight, el.fontStyle);
    const font = await pdfDoc.embedFont(fontKey);
    const align: string = el.alignment || "left";
    const maxWidth = Math.max(10, el.width || 100);
    const lines = wrapText(resolved, font, size, maxWidth);
    const lineHeight = (el.lineHeight || 1.4) * size;
    let y = el.y + Math.max(el.height || size, size);
    for (const line of lines) {
      const w = font.widthOfTextAtSize(line, size);
      let x = el.x;
      if (align === "center") x = el.x + (maxWidth - w) / 2;
      else if (align === "right") x = el.x + (maxWidth - w);
      if (line !== "") {
        page.drawText(line, { x, y, size, font, color });
      }
      y -= lineHeight;
    }
    void pdfDoc;
  }

  private static drawBox(
    page: PDFPage,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    borderWidth = 1,
    fill?: string,
  ) {
    const border = hexToRgb(color);
    const thickness = Math.max(0.5, borderWidth || 1);
    if (fill && fill !== "transparent") {
      page.drawRectangle({ x, y, width: w, height: h, color: hexToRgb(fill) });
    }
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      borderColor: border,
      borderWidth: thickness,
    });
  }
}
