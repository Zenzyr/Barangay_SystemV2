import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
import { applyVariables, TiptapNode } from "../utils/tiptapDoc";

export interface PdfPageSetup {
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
  background?: string;
  watermarkText?: string;
}

export type ImageLoader = (
  doc: PDFDocument,
  source: string,
) => Promise<PDFImage | null>;

const DEFAULT_SIZE = 11;
const LINE_FACTOR = 1.2;
const LIST_INDENT = 36;
const CELL_PAD_X = 5;
const CELL_PAD_Y = 2;

const HEADING_STYLE: Record<
  number,
  { size: number; before: number; after: number }
> = {
  1: { size: 24, before: 12, after: 6 },
  2: { size: 18, before: 10, after: 5 },
  3: { size: 14, before: 8, after: 4 },
  4: { size: 12, before: 6, after: 3 },
};

const toPt = (raw: unknown): number => {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const m = /^(-?\d*\.?\d+)\s*(pt|px|in|cm|mm)?$/i.exec(String(raw).trim());
  if (!m) return 0;
  const n = parseFloat(m[1]);
  switch ((m[2] || "pt").toLowerCase()) {
    case "px":
      return n * 0.75;
    case "in":
      return n * 72;
    case "cm":
      return (n / 2.54) * 72;
    case "mm":
      return (n / 25.4) * 72;
    default:
      return n;
  }
};

const colour = (hex: unknown, fallback = "#000000") => {
  const s =
    typeof hex === "string" && /^#[0-9a-f]{3,6}$/i.test(hex.trim())
      ? hex.trim()
      : fallback;
  const clean = s.slice(1);
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const n = parseInt(full, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

type Family = "times" | "helvetica" | "courier";
const FAMILIES: Record<Family, Record<string, StandardFonts>> = {
  times: {
    n: StandardFonts.TimesRoman,
    b: StandardFonts.TimesRomanBold,
    i: StandardFonts.TimesRomanItalic,
    bi: StandardFonts.TimesRomanBoldItalic,
  },
  helvetica: {
    n: StandardFonts.Helvetica,
    b: StandardFonts.HelveticaBold,
    i: StandardFonts.HelveticaOblique,
    bi: StandardFonts.HelveticaBoldOblique,
  },
  courier: {
    n: StandardFonts.Courier,
    b: StandardFonts.CourierBold,
    i: StandardFonts.CourierOblique,
    bi: StandardFonts.CourierBoldOblique,
  },
};

function familyOf(name: string | undefined): Family {
  const n = String(name || "calibri").toLowerCase();
  if (/courier|mono|consolas/.test(n)) return "courier";
  if (
    /times|georgia|bookman|bodoni|cambria|garamond|serif|engravers|palatino/.test(
      n,
    ) &&
    !/sans/.test(n)
  )
    return "times";
  return "helvetica";
}

class FontBook {
  private cache = new Map<StandardFonts, Promise<PDFFont>>();
  private encodable = new Map<string, boolean>();
  constructor(private pdfDoc: PDFDocument) {}

  get(
    family: string | undefined,
    bold: boolean,
    italic: boolean,
  ): Promise<PDFFont> {
    const style = `${bold ? "b" : ""}${italic ? "i" : ""}` || "n";
    const key = FAMILIES[familyOf(family)][style];
    if (!this.cache.has(key)) this.cache.set(key, this.pdfDoc.embedFont(key));
    return this.cache.get(key)!;
  }

  safe(font: PDFFont, text: string): string {
    let out = "";
    for (const ch of text.replace(/\t/g, "        ")) {
      const cacheKey = `${font.name}:${ch}`;
      let ok = this.encodable.get(cacheKey);
      if (ok === undefined) {
        try {
          font.encodeText(ch);
          ok = true;
        } catch {
          ok = false;
        }
        this.encodable.set(cacheKey, ok);
      }
      out += ok ? ch : "?";
    }
    return out;
  }
}

interface Item {
  height: number;
  before: number;
  after: number;
  pageBreak?: boolean;
  draw: (page: PDFPage, x: number, top: number) => void;
}

interface TextAtom {
  kind: "word" | "space";
  text: string;
  width: number;
  font: PDFFont;
  size: number;
  color: ReturnType<typeof rgb>;
  underline: boolean;
  strike: boolean;
  highlight?: ReturnType<typeof rgb>;
  shift: number;
}
interface ImageAtom {
  kind: "image";
  image: PDFImage;
  width: number;
  height: number;
}
type Atom = TextAtom | ImageAtom | { kind: "break" };

interface Ctx {
  fonts: FontBook;
  images: Map<string, PDFImage | null>;
}

async function inlineAtoms(
  nodes: TiptapNode[],
  base: { size: number; bold: boolean },
  ctx: Ctx,
): Promise<Atom[]> {
  const atoms: Atom[] = [];
  for (const node of nodes) {
    if (node.type === "hardBreak") {
      atoms.push({ kind: "break" });
      continue;
    }
    if (node.type === "image") {
      const image = ctx.images.get(String(node.attrs?.src || ""));
      if (image) {
        const w = toPt(node.attrs?.width) || image.width * 0.75;
        const h = toPt(node.attrs?.height) || (w * image.height) / image.width;
        atoms.push({ kind: "image", image, width: w, height: h });
      }
      continue;
    }

    let text = "";
    if (node.type === "text") text = node.text || "";
    else if (node.type === "templateVariable") text = `{{${node.attrs?.key}}}`;
    else continue;

    const marks = node.marks || [];
    const has = (t: string) => marks.some((m) => m.type === t);
    const style = marks.find((m) => m.type === "textStyle")?.attrs || {};
    let size = toPt(style.fontSize) || base.size;
    let shift = 0;
    if (has("superscript")) {
      shift = size * 0.35;
      size *= 0.7;
    } else if (has("subscript")) {
      shift = -size * 0.12;
      size *= 0.7;
    }
    const font = await ctx.fonts.get(
      style.fontFamily,
      has("bold") || base.bold,
      has("italic"),
    );
    if (style.textTransform === "uppercase") text = text.toUpperCase();
    const isLink = has("link");
    const highlight = marks.find((m) => m.type === "highlight");

    for (const part of ctx.fonts.safe(font, text).match(/ +|[^ ]+/g) || []) {
      atoms.push({
        kind: part[0] === " " ? "space" : "word",
        text: part,
        width: font.widthOfTextAtSize(part, size),
        font,
        size,
        color: colour(style.color ?? (isLink ? "#1d4ed8" : undefined)),
        underline: has("underline") || isLink,
        strike: has("strike"),
        highlight: highlight
          ? colour(highlight.attrs?.color, "#ffff00")
          : undefined,
        shift,
      });
    }
  }
  return atoms;
}

interface Line {
  atoms: Atom[];
  width: number;
  height: number;
  ascent: number;
  hardEnd: boolean;
}

function breakLines(
  atoms: Atom[],
  firstWidth: number,
  width: number,
  lineMultiple: number,
): Line[] {
  const lines: Line[] = [];
  let cur: Atom[] = [];
  let curWidth = 0;
  let limit = firstWidth;

  const close = (hardEnd: boolean) => {
    while (cur.length && cur[cur.length - 1].kind === "space") {
      curWidth -= (cur.pop() as TextAtom).width;
    }
    let maxSize = DEFAULT_SIZE;
    let imageHeight = 0;
    for (const a of cur) {
      if (a.kind === "image") imageHeight = Math.max(imageHeight, a.height);
      else if (a.kind !== "break") maxSize = Math.max(maxSize, a.size);
    }
    const textHeight = maxSize * LINE_FACTOR * lineMultiple;
    const height = Math.max(textHeight, imageHeight ? imageHeight + 2 : 0);
    const ascent =
      imageHeight > textHeight
        ? height - maxSize * 0.25
        : (height - maxSize * LINE_FACTOR) / 2 + maxSize * 0.92;
    lines.push({ atoms: cur, width: curWidth, height, ascent, hardEnd });
    cur = [];
    curWidth = 0;
    limit = width;
  };

  for (const atom of atoms) {
    if (atom.kind === "break") {
      close(true);
      continue;
    }
    const w = atom.width;
    if (atom.kind === "space" && cur.length === 0) continue; // no leading spaces after a wrap
    if (curWidth + w > limit && cur.length > 0 && atom.kind !== "space")
      close(false);
    cur.push(atom);
    curWidth += w;
  }
  if (cur.length || lines.length === 0) close(true);
  return lines;
}

function drawLine(
  page: PDFPage,
  line: Line,
  x: number,
  top: number,
  boxWidth: number,
  align: string,
) {
  const justify = align === "justify" && !line.hardEnd;
  const spaces = line.atoms.filter((a) => a.kind === "space").length;
  const extra =
    justify && spaces ? Math.max(0, boxWidth - line.width) / spaces : 0;
  const effective = line.width + extra * spaces;
  let cx = x;
  if (align === "center") cx = x + (boxWidth - effective) / 2;
  else if (align === "right") cx = x + (boxWidth - effective);

  const baseline = top - line.ascent;
  for (const a of line.atoms) {
    if (a.kind === "image") {
      page.drawImage(a.image, {
        x: cx,
        y: top - line.height + (line.height - a.height) / 2,
        width: a.width,
        height: a.height,
      });
      cx += a.width;
      continue;
    }
    if (a.kind === "break") continue;
    const w = a.width + (a.kind === "space" ? extra : 0);
    if (a.highlight)
      page.drawRectangle({
        x: cx,
        y: baseline - a.size * 0.22 + a.shift,
        width: w,
        height: a.size * 1.1,
        color: a.highlight,
      });
    if (a.kind === "word")
      page.drawText(a.text, {
        x: cx,
        y: baseline + a.shift,
        size: a.size,
        font: a.font,
        color: a.color,
      });
    if (a.underline)
      page.drawLine({
        start: { x: cx, y: baseline - a.size * 0.12 + a.shift },
        end: { x: cx + w, y: baseline - a.size * 0.12 + a.shift },
        thickness: Math.max(0.5, a.size / 20),
        color: a.color,
      });
    if (a.strike)
      page.drawLine({
        start: { x: cx, y: baseline + a.size * 0.3 + a.shift },
        end: { x: cx + w, y: baseline + a.size * 0.3 + a.shift },
        thickness: Math.max(0.5, a.size / 20),
        color: a.color,
      });
    cx += w;
  }
}

async function paragraphItems(
  node: TiptapNode,
  width: number,
  ctx: Ctx,
): Promise<Item[]> {
  const a = node.attrs || {};
  const heading =
    node.type === "heading"
      ? HEADING_STYLE[Math.min(4, Math.max(1, Number(a.level) || 1))]
      : null;
  const left = toPt(a.marginLeft);
  const first = toPt(a.textIndent);
  const lineMultiple =
    parseFloat(a.lineHeight) > 0 ? parseFloat(a.lineHeight) : 1;
  const align: string = a.textAlign || "left";
  const before =
    a.spaceBefore !== undefined && a.spaceBefore !== null
      ? toPt(a.spaceBefore)
      : (heading?.before ?? 0);
  const after =
    a.spaceAfter !== undefined && a.spaceAfter !== null
      ? toPt(a.spaceAfter)
      : (heading?.after ?? 0);

  const atoms = await inlineAtoms(
    node.content || [],
    { size: heading?.size ?? DEFAULT_SIZE, bold: !!heading },
    ctx,
  );
  const boxWidth = Math.max(20, width - left);
  const firstIndent = Math.max(-left, first);
  const lines = breakLines(
    atoms,
    boxWidth - Math.max(0, firstIndent),
    boxWidth,
    lineMultiple,
  );
  return lines.map((line, i) => ({
    height: line.height,
    before: i === 0 ? before : 0,
    after: i === lines.length - 1 ? after : 0,
    draw: (page, x, top) => {
      const indent = i === 0 ? firstIndent : 0;
      drawLine(
        page,
        line,
        x + left + indent,
        top,
        boxWidth - Math.max(0, indent),
        align,
      );
    },
  }));
}

async function markerFont(ctx: Ctx) {
  return ctx.fonts.get("helvetica", false, false);
}

async function blockItems(
  node: TiptapNode,
  width: number,
  ctx: Ctx,
  listDepth = 0,
): Promise<Item[]> {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return paragraphItems(node, width, ctx);

    case "image":
      return paragraphItems({ type: "paragraph", content: [node] }, width, ctx);

    case "horizontalRule":
      return [
        {
          height: 4,
          before: 2,
          after: 3,
          draw: (page, x, top) =>
            page.drawLine({
              start: { x, y: top - 2 },
              end: { x: x + width, y: top - 2 },
              thickness: 0.75,
              color: rgb(0, 0, 0),
            }),
        },
      ];

    case "pageBreak":
      return [
        {
          height: 0,
          before: 0,
          after: 0,
          pageBreak: true,
          draw: () => undefined,
        },
      ];

    case "bulletList":
    case "orderedList": {
      const items: Item[] = [];
      let n = Number(node.attrs?.start) || 1;
      const font = await markerFont(ctx);
      for (const li of node.content || []) {
        const label =
          node.type === "bulletList" ? (listDepth % 2 ? "o" : "•") : `${n++}.`;
        const children: Item[] = [];
        for (const child of li.content || []) {
          children.push(
            ...(await blockItems(
              child,
              width - LIST_INDENT,
              ctx,
              listDepth + 1,
            )),
          );
        }
        children.forEach((it, i) => {
          const draw = it.draw;
          items.push({
            ...it,
            draw: (page, x, top) => {
              if (i === 0) {
                const safe = ctx.fonts.safe(font, label);
                page.drawText(safe, {
                  x:
                    x +
                    LIST_INDENT -
                    6 -
                    font.widthOfTextAtSize(safe, DEFAULT_SIZE),
                  y: top - it.height * 0.75,
                  size: DEFAULT_SIZE,
                  font,
                });
              }
              draw(page, x + LIST_INDENT, top);
            },
          });
        });
      }
      return items;
    }

    case "table":
      return tableItems(node, width, ctx);

    default:
      return [];
  }
}

async function flow(
  nodes: TiptapNode[],
  width: number,
  ctx: Ctx,
): Promise<Item[]> {
  const items: Item[] = [];
  for (const node of nodes) items.push(...(await blockItems(node, width, ctx)));
  return items;
}

function stackHeight(items: Item[]): number {
  let total = 0;
  let prevAfter = 0;
  items.forEach((it, i) => {
    total += (i === 0 ? it.before : Math.max(prevAfter, it.before)) + it.height;
    prevAfter = it.after;
  });
  return total;
}

function drawStack(page: PDFPage, items: Item[], x: number, top: number) {
  let y = top;
  let prevAfter = 0;
  items.forEach((it, i) => {
    y -= i === 0 ? it.before : Math.max(prevAfter, it.before);
    it.draw(page, x, y);
    y -= it.height;
    prevAfter = it.after;
  });
}

async function tableItems(
  node: TiptapNode,
  width: number,
  ctx: Ctx,
): Promise<Item[]> {
  const rows = node.content || [];
  const borderless = node.attrs?.borders === "none";
  const firstRow = rows[0]?.content || [];
  const spans = firstRow.reduce((n, c) => n + (c.attrs?.colspan || 1), 0) || 1;

  const colWidths: number[] = [];
  for (const cell of firstRow) {
    const span = cell.attrs?.colspan || 1;
    const widths: (number | null)[] = Array.isArray(cell.attrs?.colwidth)
      ? cell.attrs!.colwidth
      : [];
    for (let i = 0; i < span; i++)
      colWidths.push(widths[i] ? widths[i]! * 0.75 : width / spans);
  }
  const total = colWidths.reduce((s, w) => s + w, 0);
  if (total > width)
    colWidths.forEach((w, i) => (colWidths[i] = (w * width) / total));

  const out: Item[] = [];
  for (const row of rows) {
    const cells: { x: number; w: number; items: Item[]; header: boolean }[] =
      [];
    let col = 0;
    let cx = 0;
    for (const cell of row.content || []) {
      const span = cell.attrs?.colspan || 1;
      const w = colWidths.slice(col, col + span).reduce((s, n) => s + n, 0);
      const items = await flow(
        cell.content || [],
        Math.max(10, w - CELL_PAD_X * 2),
        ctx,
      );
      cells.push({ x: cx, w, items, header: cell.type === "tableHeader" });
      cx += w;
      col += span;
    }
    const height =
      Math.max(...cells.map((c) => stackHeight(c.items)), 10) + CELL_PAD_Y * 2;
    out.push({
      height,
      before: 0,
      after: 0,
      draw: (page, x, top) => {
        for (const c of cells) {
          if (c.header && !borderless)
            page.drawRectangle({
              x: x + c.x,
              y: top - height,
              width: c.w,
              height,
              color: rgb(0.94, 0.94, 0.94),
            });
          if (!borderless)
            page.drawRectangle({
              x: x + c.x,
              y: top - height,
              width: c.w,
              height,
              borderColor: rgb(0.6, 0.6, 0.6),
              borderWidth: 0.5,
            });
          drawStack(page, c.items, x + c.x + CELL_PAD_X, top - CELL_PAD_Y);
        }
      },
    });
  }
  return out;
}

export async function renderTiptapDocument(
  pdfDoc: PDFDocument,
  content: TiptapNode,
  setup: PdfPageSetup,
  values: Record<string, string> | undefined,
  loadImage: ImageLoader,
): Promise<PDFPage[]> {
  const doc =
    values && Object.keys(values).length
      ? applyVariables(content, values)
      : content;

  const images = new Map<string, PDFImage | null>();
  const collect = (n: TiptapNode) => {
    if (n.type === "image" && typeof n.attrs?.src === "string")
      images.set(n.attrs.src, null);
    n.content?.forEach(collect);
  };
  collect(doc);
  for (const src of [...images.keys()])
    images.set(
      src,
      /^https?:/i.test(src) ? null : await loadImage(pdfDoc, src),
    );
  const background = setup.background
    ? await loadImage(pdfDoc, setup.background)
    : null;

  const ctx: Ctx = { fonts: new FontBook(pdfDoc), images };
  const { width, height, margins } = setup;
  const contentWidth = Math.max(50, width - margins.left - margins.right);
  const items = await flow(doc.content || [], contentWidth, ctx);

  const pages: PDFPage[] = [];
  const newPage = () => {
    const page = pdfDoc.addPage([width, height]);
    if (background) {
      const scale = Math.max(
        width / background.width,
        height / background.height,
      );
      page.drawImage(background, {
        x: 0,
        y: 0,
        width: background.width * scale,
        height: background.height * scale,
      });
    }
    pages.push(page);
    return page;
  };

  let page = newPage();
  let y = height - margins.top;
  let atTop = true;
  let prevAfter = 0;
  const limit = margins.bottom;

  for (const item of items) {
    if (item.pageBreak) {
      page = newPage();
      y = height - margins.top;
      atTop = true;
      prevAfter = 0;
      continue;
    }
    let gap = atTop ? item.before : Math.max(prevAfter, item.before);
    if (!atTop && y - gap - item.height < limit) {
      page = newPage();
      y = height - margins.top;
      atTop = true;
      gap = item.before;
    }
    y -= gap;
    item.draw(page, margins.left, y);
    y -= item.height;
    prevAfter = item.after;
    atTop = false;
  }

  if (setup.watermarkText) {
    const font = await ctx.fonts.get("helvetica", false, false);
    const text = ctx.fonts.safe(font, setup.watermarkText);
    for (const p of pages) {
      p.drawText(text, {
        x: 60,
        y: height / 2 - 80,
        size: 40,
        font,
        color: rgb(0.85, 0.85, 0.85),
        rotate: degrees(-30),
      });
    }
  }
  return pages;
}
