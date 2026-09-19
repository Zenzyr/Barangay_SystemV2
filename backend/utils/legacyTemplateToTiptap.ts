import {
  legacyKeyToVariable,
  TEMPLATE_VARIABLE_KEYS,
} from "./templateVariables";
import { isAllowedImageSrc, TiptapMark, TiptapNode } from "./tiptapDoc";

interface LegacyElement {
  id?: string;
  type: string;
  content?: string;
  field?: string;
  source?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  underline?: boolean;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  signaturePosition?: string;
  rows?: { label?: string; value?: string }[];
}

interface LegacyTemplate {
  page?: { size?: string; margins?: { left?: number; right?: number } };
  elements?: LegacyElement[];
}

export interface ConversionResult {
  editorContent: TiptapNode;
  notes: string[];
}

const DEFAULT_SIZE = 11;
const ROW_TOLERANCE_PT = 8;
const px = (pt: number) => Math.round((pt * 4) / 3);

function placeholderRuns(
  text: string,
  marks: TiptapMark[] | undefined,
  notes: Set<string>,
): TiptapNode[] {
  const out: TiptapNode[] = [];
  const push = (t: string) => {
    if (t) out.push({ type: "text", text: t, ...(marks ? { marks } : {}) });
  };
  const pattern = /\{\{([a-zA-Z0-9_. ]+)\}\}|\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    push(text.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;

    const raw = (match[1] ?? match[2]).trim();
    const key = TEMPLATE_VARIABLE_KEYS.has(raw)
      ? raw
      : (legacyKeyToVariable(raw) ??
        legacyKeyToVariable(`resident.${raw}`) ??
        legacyKeyToVariable(`certificate.${raw}`));
    if (key) {
      out.push({
        type: "templateVariable",
        attrs: { key },
        ...(marks ? { marks } : {}),
      });
    } else {
      notes.add(
        `Field "${match[0]}" has no equivalent variable and was kept as plain text.`,
      );
      push(match[0]);
    }
  }
  push(text.slice(last));
  return out;
}

function markFor(el: LegacyElement): TiptapMark[] | undefined {
  const marks: TiptapMark[] = [];
  if (el.fontWeight === "bold") marks.push({ type: "bold" });
  if (el.fontStyle === "italic") marks.push({ type: "italic" });
  if (el.underline) marks.push({ type: "underline" });
  const style: Record<string, string> = {};
  if (el.fontFamily) style.fontFamily = el.fontFamily;
  if (el.fontSize && el.fontSize !== DEFAULT_SIZE)
    style.fontSize = `${el.fontSize}pt`;
  if (el.color && el.color.toLowerCase() !== "#000000") style.color = el.color;
  if (Object.keys(style).length)
    marks.push({ type: "textStyle", attrs: style });
  return marks.length ? marks : undefined;
}

function paragraph(
  runs: TiptapNode[],
  attrs: Record<string, string>,
): TiptapNode {
  return {
    type: "paragraph",
    ...(Object.keys(attrs).length ? { attrs } : {}),
    ...(runs.length ? { content: runs } : {}),
  };
}

function layoutAttrs(
  el: LegacyElement,
  gapBefore: number,
  leftOffset: number,
): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (el.alignment && el.alignment !== "left") attrs.textAlign = el.alignment;
  if (gapBefore >= 1)
    attrs.spaceBefore = `${Math.min(Math.round(gapBefore), 160)}pt`;
  if (leftOffset >= 6) attrs.marginLeft = `${Math.round(leftOffset)}pt`;
  if (el.lineHeight && el.lineHeight > 0) {
    const multiple = Math.round((el.lineHeight / 1.2) * 20) / 20;
    if (multiple !== 1) attrs.lineHeight = String(multiple);
  }
  return attrs;
}

function elementBlocks(
  el: LegacyElement,
  gapBefore: number,
  leftOffset: number,
  notes: Set<string>,
): TiptapNode[] {
  switch (el.type) {
    case "text": {
      const marks = markFor(el);
      const lines = String(el.content ?? "").split("\n");
      return lines.map((line, i) =>
        paragraph(
          placeholderRuns(line, marks, notes),
          layoutAttrs(el, i === 0 ? gapBefore : 0, leftOffset),
        ),
      );
    }
    case "dynamicText": {
      const marks = markFor(el);
      const key = el.field ? legacyKeyToVariable(el.field) : null;
      const runs: TiptapNode[] = key
        ? [
            {
              type: "templateVariable",
              attrs: { key },
              ...(marks ? { marks } : {}),
            },
          ]
        : placeholderRuns(el.field ? `{{${el.field}}}` : "", marks, notes);
      return [paragraph(runs, layoutAttrs(el, gapBefore, leftOffset))];
    }
    case "image": {
      const source: string = el.source ?? "";
      if (!isAllowedImageSrc(source)) {
        notes.add(
          source
            ? `An image (${String(source).slice(0, 60)}) uses a source the new editor cannot store and was left out.`
            : "An empty image placeholder was left out.",
        );
        return [];
      }
      const attrs: Record<string, string> = {};
      if (gapBefore >= 1)
        attrs.spaceBefore = `${Math.min(Math.round(gapBefore), 160)}pt`;
      const center = leftOffset + el.width / 2;
      return [
        paragraph(
          [
            {
              type: "image",
              attrs: {
                src: source,
                alt: "",
                width: px(el.width),
                height: px(el.height),
              },
            },
          ],
          {
            ...attrs,
            ...(leftOffset > 12 && center > 200 ? { textAlign: "center" } : {}),
          },
        ),
      ];
    }
    case "line":
      return [{ type: "horizontalRule" }];
    case "signature": {
      notes.add(
        "Signature blocks are converted to a text signature (name and position). The official's signature image is not carried over.",
      );
      const position = el.signaturePosition || "Punong Barangay";
      const key = legacyKeyToVariable(`official.${position}`);
      const nameRuns: TiptapNode[] = key
        ? [
            {
              type: "templateVariable",
              attrs: { key },
              marks: [{ type: "bold" }, { type: "underline" }],
            },
          ]
        : [{ type: "text", text: position }];
      const spacing = {
        ...(gapBefore >= 1
          ? { spaceBefore: `${Math.min(Math.round(gapBefore), 160)}pt` }
          : {}),
        textAlign: "center",
      };
      return [
        paragraph(nameRuns, spacing),
        paragraph([{ type: "text", text: position }], { textAlign: "center" }),
      ];
    }
    case "table": {
      const rows = (el.rows?.length ? el.rows : [{ label: "", value: "" }]).map(
        (row) => ({
          type: "tableRow",
          content: [row.label ?? "", row.value ?? ""].map((cell, i) => ({
            type: "tableCell",
            attrs: { colspan: 1, rowspan: 1, colwidth: [px(el.width / 2)] },
            content: [
              paragraph(
                placeholderRuns(
                  cell,
                  i === 0 ? [{ type: "bold" }] : undefined,
                  notes,
                ),
                {},
              ),
            ],
          })),
        }),
      );
      return [{ type: "table", attrs: { borders: "all" }, content: rows }];
    }
    case "rect":
      notes.add(
        "Rectangles/frames are not supported by the new editor and were left out.",
      );
      return [];
    default:
      return [];
  }
}

function groupRows(elements: LegacyElement[]): LegacyElement[][] {
  const sorted = [...elements].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: LegacyElement[][] = [];
  for (const el of sorted) {
    const row = rows[rows.length - 1];
    const overlapsInX = row?.some(
      (other) => el.x < other.x + other.width && other.x < el.x + el.width,
    );
    if (
      row &&
      Math.abs(el.y - row[0].y) <= ROW_TOLERANCE_PT &&
      !overlapsInX &&
      el.type !== "line"
    )
      row.push(el);
    else rows.push([el]);
  }
  return rows.map((r) => r.sort((a, b) => a.x - b.x));
}

export function legacyTemplateToTiptap(
  template: LegacyTemplate,
): ConversionResult {
  const notes = new Set<string>();
  const elements = (template.elements ?? []).filter(
    (el) => el && typeof el.type === "string",
  );
  const marginLeft = template.page?.margins?.left ?? 50;
  const content: TiptapNode[] = [];

  let cursorY = 0;
  let firstRow = true;
  for (const row of groupRows(elements)) {
    const top = row[0].y;
    const gap = firstRow ? 0 : top - cursorY;
    firstRow = false;

    if (row.length === 1) {
      content.push(
        ...elementBlocks(
          row[0],
          gap,
          Math.max(0, row[0].x - marginLeft),
          notes,
        ),
      );
    } else {
      const total = row.reduce((s, e) => s + e.width, 0) || 1;
      notes.add(
        "Elements placed side by side were converted to a borderless table.",
      );
      content.push({
        type: "table",
        attrs: { borders: "none" },
        content: [
          {
            type: "tableRow",
            content: row.map((el) => {
              const blocks = elementBlocks(el, 0, 0, notes);
              return {
                type: "tableCell",
                attrs: {
                  colspan: 1,
                  rowspan: 1,
                  colwidth: [px((el.width / total) * 480)],
                },
                content: blocks.length ? blocks : [paragraph([], {})],
              };
            }),
          },
        ],
      });
    }
    cursorY = Math.max(...row.map((e) => e.y + Math.max(e.height, 0)));
  }

  if (elements.length)
    notes.add(
      "Exact positions were not preserved: the content now flows top to bottom. Review the layout before saving.",
    );
  return {
    editorContent: {
      type: "doc",
      content: content.length ? content : [{ type: "paragraph" }],
    },
    notes: [...notes],
  };
}
