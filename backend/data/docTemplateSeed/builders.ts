// Tiny helpers for writing Tiptap JSON by hand. The six bundled templates are
// transcribed from the original .docx files with these (see ./templates.ts).

import type { TiptapNode, TiptapMark } from "../../utils/tiptapDoc";

export interface Style {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  font?: string;
  /** Font size in pt. */
  size?: number;
  color?: string;
  /** Render in capitals (Word "All caps"). */
  caps?: boolean;
}

const marks = (s?: Style): TiptapMark[] | undefined => {
  if (!s) return undefined;
  const out: TiptapMark[] = [];
  if (s.b) out.push({ type: "bold" });
  if (s.i) out.push({ type: "italic" });
  if (s.u) out.push({ type: "underline" });
  const textStyle: Record<string, string> = {};
  if (s.font) textStyle.fontFamily = s.font;
  if (s.size) textStyle.fontSize = `${s.size}pt`;
  if (s.color) textStyle.color = s.color;
  if (s.caps) textStyle.textTransform = "uppercase";
  if (Object.keys(textStyle).length) out.push({ type: "textStyle", attrs: textStyle });
  return out.length ? out : undefined;
};

/** Text run. */
export const t = (text: string, style?: Style): TiptapNode => {
  const m = marks(style);
  return { type: "text", text, ...(m ? { marks: m } : {}) };
};

/** Template variable chip ({{key}}). */
export const v = (key: string, style?: Style): TiptapNode => {
  const m = marks(style);
  return { type: "templateVariable", attrs: { key }, ...(m ? { marks: m } : {}) };
};

export type Inline = TiptapNode | string;

export interface ParaOpts {
  align?: "left" | "center" | "right" | "justify";
  /** First-line indent in pt (negative = hanging; pair with `left`). */
  indent?: number;
  /** Left indent in pt. */
  left?: number;
  before?: number;
  after?: number;
  /** Line-height multiplier, e.g. 1.15. */
  line?: number;
  /** Default style applied to plain-string content. */
  style?: Style;
}

/** Paragraph. Plain strings become text runs using `opts.style`. */
export const p = (content: Inline | Inline[] = [], opts: ParaOpts = {}): TiptapNode => {
  const list = Array.isArray(content) ? content : [content];
  const nodes = list
    .filter((c) => c !== "")
    // Plain strings and un-styled variable chips take the paragraph's default style.
    .map((c) =>
      typeof c === "string"
        ? t(c, opts.style)
        : c.type === "templateVariable" && !c.marks
          ? v(c.attrs?.key, opts.style)
          : c
    );
  const attrs: Record<string, any> = {};
  if (opts.align) attrs.textAlign = opts.align;
  if (opts.indent) attrs.textIndent = `${opts.indent}pt`;
  if (opts.left) attrs.marginLeft = `${opts.left}pt`;
  if (opts.before) attrs.spaceBefore = `${opts.before}pt`;
  if (opts.after !== undefined) attrs.spaceAfter = `${opts.after}pt`;
  if (opts.line) attrs.lineHeight = String(opts.line);
  return {
    type: "paragraph",
    ...(Object.keys(attrs).length ? { attrs } : {}),
    ...(nodes.length ? { content: nodes } : {}),
  };
};

/** Empty paragraph(s) used as vertical space, like the blank lines in the originals. */
export const gap = (count = 1, after = 0): TiptapNode[] =>
  Array.from({ length: count }, () => p([], { after }));

export const pageBreak = (): TiptapNode => ({ type: "pageBreak" });
export const rule = (): TiptapNode => ({ type: "horizontalRule" });

// Natural pixel sizes of the bundled images, so a logo is always drawn with its
// true aspect ratio (the Word originals crop/stretch some of them).
const IMAGE_PX: Record<string, [number, number]> = {
  "0347f9.png": [243, 212], "1bf6ef.png": [191, 222], "258a45.png": [195, 163], "2b39a1.jpeg": [243, 239],
  "33a295.png": [245, 245], "3c31c8.jpeg": [180, 235], "3f45b0.jpeg": [167, 220], "4577f2.png": [167, 156],
  "6cf151.jpeg": [156, 156], "89dbf7.jpeg": [195, 190], "8dd33b.jpeg": [324, 432], "ac6ab4.png": [278, 290],
  "c27702.png": [172, 193], "e05e85.jpeg": [225, 224], "ed9f16.jpeg": [238, 223],
};

/** Inline image `widthPt` wide (height follows the image). `name` is a file under /assets/docx-templates/shared/. */
export const img = (name: string, widthPt: number, alt = ""): TiptapNode => {
  const [w, h] = IMAGE_PX[name] ?? [1, 1];
  return {
    type: "image",
    attrs: {
      src: `/assets/docx-templates/shared/${name}`,
      alt,
      width: Math.round((widthPt * 4) / 3),
      height: Math.round(((widthPt * h) / w) * (4 / 3)),
    },
  };
};

export const bullets = (items: TiptapNode[][]): TiptapNode => ({
  type: "bulletList",
  content: items.map((content) => ({ type: "listItem", content })),
});

export const numbered = (items: TiptapNode[][]): TiptapNode => ({
  type: "orderedList",
  attrs: { start: 1 },
  content: items.map((content) => ({ type: "listItem", content })),
});

export interface CellSpec {
  content: TiptapNode[];
  /** Column width in px (Tiptap's unit). */
  width?: number;
  colspan?: number;
}

/** Borderless layout table (letterheads, side-by-side panels) or a bordered data table. */
export const table = (rows: CellSpec[][], opts: { borders?: "none" | "all" } = {}): TiptapNode => ({
  type: "table",
  attrs: { borders: opts.borders ?? "all" },
  content: rows.map((row) => ({
    type: "tableRow",
    content: row.map((cell) => ({
      type: "tableCell",
      attrs: {
        colspan: cell.colspan ?? 1,
        rowspan: 1,
        colwidth: cell.width ? [cell.width] : null,
      },
      content: cell.content.length ? cell.content : [p()],
    })),
  })),
});

export const doc = (content: TiptapNode[]): TiptapNode => ({ type: "doc", content });

export interface LetterheadOpts {
  /** Total text width in pt (page width minus margins). */
  width: number;
  left: TiptapNode[];
  right: TiptapNode[];
  leftWidth: number;
  rightWidth: number;
  lines: TiptapNode[];
}

/**
 * Three-column letterhead: logos | centered office lines | logos. Replaces the
 * floating, behind-text logo anchors of the Word originals with a table so the
 * layout stays stable when the text is edited.
 */
export const letterhead = (o: LetterheadOpts): TiptapNode => {
  const px = (pt: number) => Math.round((pt * 4) / 3);
  const centerWidth = o.width - o.leftWidth - o.rightWidth;
  return table(
    [
      [
        { content: [p(o.left, { align: "left" })], width: px(o.leftWidth) },
        { content: o.lines, width: px(centerWidth) },
        { content: [p(o.right, { align: "right" })], width: px(o.rightWidth) },
      ],
    ],
    { borders: "none" }
  );
};
