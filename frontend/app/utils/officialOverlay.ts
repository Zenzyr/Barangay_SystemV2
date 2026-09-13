import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { officialOverlaySlot } from "@/app/types/barangaySettings.type";

const FONT_MAP: Record<officialOverlaySlot["font"], StandardFonts> = {
  "helvetica-bold": StandardFonts.HelveticaBold,
  helvetica: StandardFonts.Helvetica,
  "times-bold": StandardFonts.TimesRomanBold,
};

function parseColor(hex: string) {
  const value = (hex || "#000000").replace("#", "");
  const r = parseInt(value.substring(0, 2) || "00", 16) / 255;
  const g = parseInt(value.substring(2, 4) || "00", 16) / 255;
  const b = parseInt(value.substring(4, 6) || "00", 16) / 255;
  return rgb(r, g, b);
}

function drawSlot(
  page: PDFPage,
  slot: officialOverlaySlot,
  text: string,
  font: PDFFont,
  white: ReturnType<typeof rgb>
) {
  const { width, height } = page.getSize();

  const boxW = slot.w * width;
  const boxH = slot.h * height;
  const boxX = slot.x * width;
  const boxYTop = slot.y * height; // distance from top of page

  // 1) White-cover the printed (rasterized) name so the old one disappears.
  page.drawRectangle({
    x: boxX,
    y: height - boxYTop - boxH,
    width: boxW,
    height: boxH,
    color: white,
    borderColor: white,
  });

  if (!text) return;

  // 2) Redraw the active official's name over the covered region.
  const fontSize = boxH * (slot.fontScale || 0.85);
  const textWidth = font.widthOfTextAtSize(text, fontSize);

  let textX = boxX;
  if (slot.align === "center") {
    textX = boxX + boxW / 2 - textWidth / 2;
  } else if (slot.align === "right") {
    textX = boxX + boxW - textWidth;
  }

  const textY = height - boxYTop - boxH / 2 - fontSize / 3;

  page.drawText(text, {
    x: textX,
    y: textY,
    size: fontSize,
    font,
    color: parseColor(slot.textColor),
  });
}

/**
 * Applies the per-document official-name overlays onto the given PDF.
 * For each configured, enabled slot we cover the old rasterized name and draw
 * the CURRENT active official's name for that position. Fully dynamic: this is
 * driven entirely by the Settings data, never source code.
 */
export async function applyOfficialOverlays(
  pdfDoc: PDFDocument,
  slots: officialOverlaySlot[],
  activeByPosition: Record<string, string>
): Promise<void> {
  if (!slots || slots.length === 0) return;

  const enabled = slots.filter((s) => s.enabled && activeByPosition[s.position]);
  if (enabled.length === 0) return;

  const white = rgb(1, 1, 1);
  const pages = pdfDoc.getPages();
  const page = pages[0];
  if (!page) return;

  const fonts: Partial<Record<officialOverlaySlot["font"], PDFFont>> = {};
  const embed = async (key: officialOverlaySlot["font"]) => {
    if (!fonts[key]) fonts[key] = await pdfDoc.embedFont(FONT_MAP[key]);
    return fonts[key]!;
  };

  for (const slot of enabled) {
    drawSlot(page, slot, activeByPosition[slot.position], await embed(slot.font), white);
  }
}