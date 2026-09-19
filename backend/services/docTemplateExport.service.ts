import fs from "fs";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LevelFormat,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionRelativeFrom,
  WidthType,
} from "docx";
import { applyVariables, TiptapNode } from "../utils/tiptapDoc";

// Converts a stored Tiptap document into a real .docx with the `docx` package
// (structured Word elements — not HTML-to-DOCX). See the limitations listed at
// the bottom of this file and in the feature documentation.

export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const PAGE_TWIPS = {
  A4: { width: 11906, height: 16838 },
  Letter: { width: 12240, height: 15840 },
  Legal: { width: 12240, height: 20160 },
} as const;

const ASSET_URL_PREFIX = "/assets/docx-templates/";
const DEFAULT_FONT = "Calibri";

interface ExportInput {
  name: string;
  editorContent: TiptapNode;
  page?: {
    size?: keyof typeof PAGE_TWIPS;
    margins?: { top?: number; right?: number; bottom?: number; left?: number };
    background?: string;
    watermark?: { src?: string; opacity?: number };
  };
}

export interface ExportResult {
  buffer: Buffer;
  warnings: string[];
}

// ── unit helpers ─────────────────────────────────────────────────────────

/** "36pt" | "0.5in" | "12px" | 12 → points. */
const toPt = (raw: unknown): number | null => {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const m = /^(-?\d*\.?\d+)\s*(pt|px|in|cm|mm)?$/i.exec(String(raw).trim());
  if (!m) return null;
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

const twips = (pt: number) => Math.round(pt * 20);

const toHex = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") return undefined;
  const s = raw.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) return hex[1].toUpperCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (short)
    return `${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(s);
  if (rgb)
    return [rgb[1], rgb[2], rgb[3]]
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return undefined;
};

const firstFont = (raw: unknown): string | undefined => {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  return raw.split(",")[0].replace(/["']/g, "").trim() || undefined;
};

// ── images ───────────────────────────────────────────────────────────────

export type ImageType = "png" | "jpg" | "gif";

const assetsRoot = () =>
  process.env.TEMPLATE_ASSETS_DIR ||
  path.resolve(process.cwd(), "..", "frontend", "public");

export function loadTemplateImage(
  src: string,
): { data: Buffer; type: ImageType } | null {
  let data: Buffer | null = null;
  const dataUri = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/i.exec(src);
  if (dataUri) {
    if (dataUri[1].toLowerCase() === "webp") return null;
    data = Buffer.from(dataUri[2], "base64");
  } else if (src.startsWith(ASSET_URL_PREFIX)) {
    // Resolve inside the assets folder only (guards against path traversal).
    const root = path.resolve(assetsRoot(), "assets", "docx-templates");
    const file = path.resolve(assetsRoot(), src.replace(/^\//, ""));
    if (file !== root && !file.startsWith(root + path.sep)) return null;
    if (!fs.existsSync(file)) return null;
    data = fs.readFileSync(file);
  } else {
    return null; // remote URLs are never fetched by the exporter
  }
  if (data.length > 8 && data[0] === 0x89 && data[1] === 0x50)
    return { data, type: "png" };
  if (data.length > 3 && data[0] === 0xff && data[1] === 0xd8)
    return { data, type: "jpg" };
  if (data.length > 3 && data.toString("ascii", 0, 3) === "GIF")
    return { data, type: "gif" };
  return null;
}

/** Natural pixel size, read from the image header (used when the node has no explicit size). */
function imageSize(
  data: Buffer,
  type: ImageType,
): { width: number; height: number } {
  try {
    if (type === "png")
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    if (type === "gif")
      return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
    let i = 2;
    while (i < data.length) {
      if (data[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = data[i + 1];
      const len = data.readUInt16BE(i + 2);
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        ![0xc4, 0xc8, 0xcc].includes(marker)
      ) {
        return {
          height: data.readUInt16BE(i + 5),
          width: data.readUInt16BE(i + 7),
        };
      }
      i += 2 + len;
    }
  } catch {
    /* fall through */
  }
  return { width: 100, height: 100 };
}

// ── converter ────────────────────────────────────────────────────────────

class Converter {
  warnings: string[] = [];
  private listInstance = 0;
  private missingImages = new Set<string>();

  constructor(private textWidthTwips: number) {}

  private warn(message: string) {
    if (!this.warnings.includes(message)) this.warnings.push(message);
  }

  // ---- inline ----

  private runOptions(marks: TiptapNode["marks"] = []) {
    const o: Record<string, any> = {};
    for (const mark of marks) {
      switch (mark.type) {
        case "bold":
          o.bold = true;
          break;
        case "italic":
          o.italics = true;
          break;
        case "underline":
          o.underline = {};
          break;
        case "strike":
          o.strike = true;
          break;
        case "subscript":
          o.subScript = true;
          break;
        case "superscript":
          o.superScript = true;
          break;
        case "highlight": {
          const fill = toHex(mark.attrs?.color) || "FFFF00";
          o.shading = { type: ShadingType.CLEAR, fill, color: "auto" };
          break;
        }
        case "textStyle": {
          const a = mark.attrs || {};
          const font = firstFont(a.fontFamily);
          if (font) o.font = font;
          const size = toPt(a.fontSize);
          if (size) o.size = Math.round(size * 2);
          const color = toHex(a.color);
          if (color) o.color = color;
          if (a.textTransform === "uppercase") o.allCaps = true;
          break;
        }
      }
    }
    return o;
  }

  private textRuns(text: string, opts: Record<string, any>): TextRun[] {
    // Tabs need a real <w:tab/>, not a literal character.
    const parts = text.split("\t");
    if (parts.length === 1) return [new TextRun({ ...opts, text })];
    const children: (string | Tab)[] = [];
    parts.forEach((part, index) => {
      if (index > 0) children.push(new Tab());
      if (part) children.push(part);
    });
    return [new TextRun({ ...opts, children })];
  }

  private inline(
    nodes: TiptapNode[] = [],
  ): (TextRun | ImageRun | ExternalHyperlink)[] {
    const out: (TextRun | ImageRun | ExternalHyperlink)[] = [];
    for (const node of nodes) {
      if (node.type === "text" && node.text) {
        const opts = this.runOptions(node.marks);
        const runs = this.textRuns(node.text, opts);
        const link = node.marks?.find((m) => m.type === "link");
        if (link?.attrs?.href) {
          out.push(
            new ExternalHyperlink({
              link: link.attrs.href,
              children: runs.map((r) => r),
            }),
          );
        } else {
          out.push(...runs);
        }
      } else if (node.type === "templateVariable") {
        out.push(
          ...this.textRuns(
            `{{${node.attrs?.key}}}`,
            this.runOptions(node.marks),
          ),
        );
      } else if (node.type === "hardBreak") {
        out.push(new TextRun({ break: 1 }));
      } else if (node.type === "image") {
        const image = this.image(node);
        if (image) out.push(image);
      }
    }
    return out;
  }

  private image(node: TiptapNode): ImageRun | null {
    const src = String(node.attrs?.src || "");
    const loaded = loadTemplateImage(src);
    if (!loaded) {
      if (!this.missingImages.has(src)) {
        this.missingImages.add(src);
        this.warn(
          `Image could not be embedded and was left out: ${src.startsWith("data:") ? "inline image" : src}`,
        );
      }
      return null;
    }
    const natural = imageSize(loaded.data, loaded.type);
    const width = Number(node.attrs?.width) || natural.width;
    const height =
      Number(node.attrs?.height) ||
      Math.round((width * natural.height) / natural.width);
    return new ImageRun({
      type: loaded.type,
      data: loaded.data,
      transformation: {
        width: Math.max(1, Math.round(width)),
        height: Math.max(1, Math.round(height)),
      },
      altText: {
        name: "image",
        title: String(node.attrs?.alt || ""),
        description: String(node.attrs?.alt || ""),
      },
    });
  }

  // ---- blocks ----

  private paragraph(
    node: TiptapNode,
    extra: Record<string, any> = {},
  ): Paragraph {
    const a = node.attrs || {};
    const opts: Record<string, any> = {
      children: this.inline(node.content),
      ...extra,
    };

    const alignment = (
      {
        left: AlignmentType.LEFT,
        center: AlignmentType.CENTER,
        right: AlignmentType.RIGHT,
        justify: AlignmentType.JUSTIFIED,
      } as any
    )[a.textAlign];
    if (alignment) opts.alignment = alignment;

    const spacing: Record<string, any> = {};
    const before = toPt(a.spaceBefore);
    const after = toPt(a.spaceAfter);
    if (before !== null) spacing.before = twips(before);
    if (after !== null) spacing.after = twips(after);
    const line = parseFloat(a.lineHeight);
    if (Number.isFinite(line) && line > 0) {
      spacing.line = Math.round(240 * line);
      spacing.lineRule = LineRuleType.AUTO;
    }
    if (Object.keys(spacing).length) opts.spacing = spacing;

    if (!extra.numbering) {
      const left = toPt(a.marginLeft);
      const first = toPt(a.textIndent);
      const indent: Record<string, number> = {};
      if (left) indent.left = twips(left);
      if (first && first > 0) indent.firstLine = twips(first);
      if (first && first < 0) indent.hanging = twips(-first);
      if (Object.keys(indent).length) opts.indent = indent;
    }
    return new Paragraph(opts as any);
  }

  private heading(node: TiptapNode): Paragraph {
    const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 4);
    const map = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
    ];
    return this.paragraph(node, { heading: map[level - 1] });
  }

  private list(
    node: TiptapNode,
    level: number,
    instance?: number,
  ): Paragraph[] {
    const ordered = node.type === "orderedList";
    const inst = ordered ? (instance ?? ++this.listInstance) : undefined;
    const reference = ordered ? "numbers" : "bullets";
    const out: Paragraph[] = [];
    for (const item of node.content || []) {
      let numbered = false;
      for (const child of item.content || []) {
        if (child.type === "paragraph") {
          const extra: Record<string, any> = numbered
            ? { indent: { left: 720 * (level + 1) } }
            : {
                numbering: {
                  reference,
                  level: Math.min(level, 3),
                  ...(inst ? { instance: inst } : {}),
                },
              };
          numbered = true;
          out.push(this.paragraph(child, extra));
        } else if (
          child.type === "bulletList" ||
          child.type === "orderedList"
        ) {
          out.push(...this.list(child, level + 1));
        } else {
          out.push(
            ...(this.block(child) as Paragraph[]).filter(
              (b) => b instanceof Paragraph,
            ),
          );
        }
      }
    }
    return out;
  }

  private table(node: TiptapNode): Table {
    const rows = node.content || [];
    const borderless = node.attrs?.borders === "none";
    const first = rows[0]?.content || [];
    const spans = first.reduce((n, c) => n + (c.attrs?.colspan || 1), 0) || 1;
    const columnWidths: number[] = [];
    for (const cell of first) {
      const span = cell.attrs?.colspan || 1;
      const widths: (number | null)[] = Array.isArray(cell.attrs?.colwidth)
        ? cell.attrs!.colwidth
        : [];
      for (let i = 0; i < span; i++) {
        const px = widths[i];
        columnWidths.push(
          px ? Math.round(px * 15) : Math.round(this.textWidthTwips / spans),
        );
      }
    }
    // Never exceed the text area (Word would spill into the margins).
    const total = columnWidths.reduce((s, w) => s + w, 0);
    if (total > this.textWidthTwips) {
      const k = this.textWidthTwips / total;
      columnWidths.forEach((w, i) => (columnWidths[i] = Math.floor(w * k)));
    }

    const none = { style: BorderStyle.NONE, size: 0, color: "auto" };
    const line = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
    const border = borderless ? none : line;

    return new Table({
      layout: TableLayoutType.FIXED,
      width: {
        size: columnWidths.reduce((s, w) => s + w, 0),
        type: WidthType.DXA,
      },
      columnWidths,
      borders: {
        top: border,
        bottom: border,
        left: border,
        right: border,
        insideHorizontal: border,
        insideVertical: border,
      },
      rows: rows.map((row) => {
        let col = 0;
        return new TableRow({
          children: (row.content || []).map((cell) => {
            const span = cell.attrs?.colspan || 1;
            const width = columnWidths
              .slice(col, col + span)
              .reduce((s, w) => s + w, 0);
            col += span;
            const children = (cell.content || []).flatMap((b) => this.block(b));
            return new TableCell({
              width: { size: width, type: WidthType.DXA },
              columnSpan: span > 1 ? span : undefined,
              rowSpan:
                (cell.attrs?.rowspan ?? 1) > 1
                  ? cell.attrs?.rowspan
                  : undefined,
              borders: {
                top: border,
                bottom: border,
                left: border,
                right: border,
              },
              shading:
                cell.type === "tableHeader" && !borderless
                  ? { type: ShadingType.CLEAR, fill: "F0F0F0", color: "auto" }
                  : undefined,
              children: children.length
                ? (children as any)
                : [new Paragraph({})],
            });
          }),
        });
      }),
    });
  }

  block(node: TiptapNode): (Paragraph | Table)[] {
    switch (node.type) {
      case "paragraph":
        return [this.paragraph(node)];
      case "heading":
        return [this.heading(node)];
      case "bulletList":
      case "orderedList":
        return this.list(node, 0);
      case "table":
        return [this.table(node)];
      case "horizontalRule":
        return [
          new Paragraph({
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: "000000",
                space: 1,
              },
            },
            spacing: { after: 60 },
          }),
        ];
      case "pageBreak":
        // A near-zero-height paragraph holding the break, so the next page
        // does not start with a blank line.
        return [
          new Paragraph({
            children: [new PageBreak()],
            spacing: {
              before: 0,
              after: 0,
              line: 20,
              lineRule: LineRuleType.EXACT,
            },
          }),
        ];
      case "image": {
        const image = this.image(node);
        return image ? [new Paragraph({ children: [image] })] : [];
      }
      default:
        this.warn(`Unsupported element "${node.type}" was skipped`);
        return [];
    }
  }
}

const bulletLevels = ["•", "o", "▪", "•"].map((text, level) => ({
  level,
  format: LevelFormat.BULLET,
  text,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
}));

const numberLevels = [
  LevelFormat.DECIMAL,
  LevelFormat.LOWER_LETTER,
  LevelFormat.LOWER_ROMAN,
  LevelFormat.DECIMAL,
].map((format, level) => ({
  level,
  format,
  text: `%${level + 1}.`,
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
}));

/** Floating, behind-text image anchored to the page (used for page backgrounds). */
function pageImage(
  src: string,
  widthPx: number,
  heightPx: number,
  converter: Converter,
): ImageRun | null {
  const loaded = loadTemplateImage(src);
  if (!loaded) {
    converter.warnings.push(
      `Page background image could not be embedded: ${src}`,
    );
    return null;
  }
  return new ImageRun({
    type: loaded.type,
    data: loaded.data,
    transformation: {
      width: Math.round(widthPx),
      height: Math.round(heightPx),
    },
    floating: {
      horizontalPosition: {
        relative: HorizontalPositionRelativeFrom.PAGE,
        offset: 0,
      },
      verticalPosition: {
        relative: VerticalPositionRelativeFrom.PAGE,
        offset: 0,
      },
      behindDocument: true,
      allowOverlap: true,
      wrap: { type: TextWrappingType.NONE },
    },
    altText: { name: "background", title: "", description: "" },
  });
}

export async function exportTemplateToDocx(
  template: ExportInput,
  values?: Record<string, string>,
): Promise<ExportResult> {
  const size = PAGE_TWIPS[template.page?.size || "Letter"] || PAGE_TWIPS.Letter;
  const m = template.page?.margins || {};
  const margin = {
    top: twips(m.top ?? 72),
    right: twips(m.right ?? 72),
    bottom: twips(m.bottom ?? 72),
    left: twips(m.left ?? 72),
  };
  const textWidth = size.width - margin.left - margin.right;

  const content =
    values && Object.keys(values).length
      ? applyVariables(template.editorContent, values)
      : template.editorContent;
  const converter = new Converter(textWidth);
  const children = (content.content || []).flatMap((node) =>
    converter.block(node),
  );
  // Word needs the body to end with a paragraph (a trailing table is invalid).
  if (!children.length || children[children.length - 1] instanceof Table)
    children.push(new Paragraph({}));

  const headerChildren: Paragraph[] = [];
  if (template.page?.background) {
    const image = pageImage(
      template.page.background,
      size.width / 15,
      size.height / 15,
      converter,
    );
    if (image)
      headerChildren.push(
        new Paragraph({
          children: [image],
          spacing: {
            before: 0,
            after: 0,
            line: 20,
            lineRule: LineRuleType.EXACT,
          },
        }),
      );
  }
  if (template.page?.watermark?.src) {
    converter.warnings.push(
      "The page watermark is shown in the editor, preview and print, but is not included in the .docx",
    );
  }

  const document = new Document({
    creator: "BIMS",
    title: template.name,
    styles: {
      default: {
        document: {
          run: { font: DEFAULT_FONT, size: 22 },
          paragraph: {
            spacing: { after: 0, line: 240, lineRule: LineRuleType.AUTO },
          },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 48, bold: true, color: "000000" },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 36, bold: true, color: "000000" },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 28, bold: true, color: "000000" },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
        {
          id: "Heading4",
          name: "Heading 4",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 24, bold: true, color: "000000" },
          paragraph: { spacing: { before: 120, after: 60 } },
        },
      ],
    },
    numbering: {
      config: [
        { reference: "bullets", levels: bulletLevels },
        { reference: "numbers", levels: numberLevels },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: size.width, height: size.height },
            margin: { ...margin, header: 0, footer: 0 },
          },
        },
        headers: headerChildren.length
          ? { default: new Header({ children: headerChildren }) }
          : undefined,
        footers: headerChildren.length
          ? { default: new Footer({ children: [new Paragraph({})] }) }
          : undefined,
        children: children as any,
      },
    ],
  });

  return {
    buffer: await Packer.toBuffer(document),
    warnings: converter.warnings,
  };
}

/*
 * Known limitations (also documented for users):
 *  - Automatic pagination is decided by Word, not Tiptap: only explicit page
 *    breaks are guaranteed to match the editor.
 *  - Logos are inline images in a table, not floating "behind text" anchors.
 *  - The page background image is exported; the faded watermark is not
 *    (the docx package cannot set image transparency).
 *  - Fonts are referenced by name; a machine without e.g. Britannic Bold or
 *    Hobo Std substitutes another font.
 *  - Editor line-height is approximated with Word's "multiple" line spacing.
 *  - There is no .docx → Tiptap import; templates are authored in Tiptap.
 */
