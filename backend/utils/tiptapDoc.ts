// Structural helpers for Tiptap/ProseMirror JSON documents. Pure functions —
// the backend never needs Tiptap itself, only to validate, inspect and
// transform the JSON the editor produces.

import { VARIABLE_KEY_PATTERN } from "./templateVariables";

export interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export const ALLOWED_NODE_TYPES = new Set([
  "doc", "paragraph", "heading", "text", "hardBreak", "horizontalRule",
  "bulletList", "orderedList", "listItem",
  "table", "tableRow", "tableHeader", "tableCell",
  "image", "pageBreak", "templateVariable",
]);

export const ALLOWED_MARK_TYPES = new Set([
  "bold", "italic", "underline", "strike", "textStyle",
  "highlight", "link", "subscript", "superscript",
]);

const MAX_DEPTH = 24;
const MAX_NODES = 30000;
const MAX_JSON_BYTES = 3 * 1024 * 1024;

// Image sources: bundled template assets, inline data, or https. The DOCX
// exporter only ever reads local assets/data URIs (never fetches remote URLs).
const IMAGE_SRC_PATTERN =
  /^(\/assets\/docx-templates\/(?!.*\.\.)[\w\-./]+|data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s]+)$/;
export const isAllowedImageSrc = (src: unknown): src is string =>
  typeof src === "string" && IMAGE_SRC_PATTERN.test(src);

const LINK_HREF_PATTERN = /^(https?:\/\/|mailto:|tel:)[^\s]+$/i;

/** Returns a human-readable error, or null when the document is acceptable. */
export function validateTiptapDoc(doc: unknown): string | null {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return "Document content must be an object";
  const root = doc as TiptapNode;
  if (root.type !== "doc") return 'Document content must have type "doc"';

  let size = 0;
  try {
    size = Buffer.byteLength(JSON.stringify(doc), "utf8");
  } catch {
    return "Document content is not valid JSON";
  }
  if (size > MAX_JSON_BYTES) return "Document content is too large";

  let count = 0;
  const walk = (node: TiptapNode, depth: number): string | null => {
    if (depth > MAX_DEPTH) return "Document is nested too deeply";
    if (++count > MAX_NODES) return "Document has too many elements";
    if (!node || typeof node !== "object" || typeof node.type !== "string") return "Invalid node in document";
    if (!ALLOWED_NODE_TYPES.has(node.type)) return `Unsupported node type: ${node.type}`;

    if (node.type === "text" && typeof node.text !== "string") return "Text node is missing its text";
    if (node.type === "templateVariable") {
      const key = node.attrs?.key;
      if (typeof key !== "string" || !VARIABLE_KEY_PATTERN.test(key)) return "Invalid template variable key";
    }
    if (node.type === "image") {
      if (!isAllowedImageSrc(node.attrs?.src)) return "Unsupported image source";
    }

    for (const mark of node.marks || []) {
      if (!mark || !ALLOWED_MARK_TYPES.has(mark.type)) return `Unsupported text style: ${mark?.type}`;
      if (mark.type === "link") {
        const href = mark.attrs?.href;
        if (typeof href !== "string" || !LINK_HREF_PATTERN.test(href)) return "Unsupported link address";
      }
    }

    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) return "Invalid node content";
      for (const child of node.content) {
        const err = walk(child, depth + 1);
        if (err) return err;
      }
    }
    return null;
  };

  return walk(root, 0);
}

const LITERAL_VARIABLE = /\{\{([a-z][a-z0-9_]{0,63})\}\}/g;

/** Unique variable keys used, in document order (variable nodes and literal {{key}} text). */
export function extractVariables(doc: TiptapNode): string[] {
  const found: string[] = [];
  const add = (key: string) => {
    if (!found.includes(key)) found.push(key);
  };
  const walk = (node: TiptapNode) => {
    if (node.type === "templateVariable" && typeof node.attrs?.key === "string") add(node.attrs.key);
    if (node.type === "text" && node.text) {
      for (const match of node.text.matchAll(LITERAL_VARIABLE)) add(match[1]);
    }
    node.content?.forEach(walk);
  };
  walk(doc);
  return found;
}

/**
 * Returns a copy of the document with variables replaced by their values.
 * Variables with no supplied value are left as-is (still visible as
 * {{key}}) so they are noticed rather than silently blanked.
 */
export function applyVariables(doc: TiptapNode, values: Record<string, string>): TiptapNode {
  const transform = (node: TiptapNode): TiptapNode[] => {
    if (node.type === "templateVariable") {
      const value = values[node.attrs?.key];
      if (value === undefined) return [node];
      return [{ type: "text", text: value, ...(node.marks?.length ? { marks: node.marks } : {}) }];
    }
    if (node.type === "text" && node.text) {
      return [{ ...node, text: node.text.replace(LITERAL_VARIABLE, (m, key) => values[key] ?? m) }];
    }
    if (node.content) {
      return [{ ...node, content: node.content.flatMap(transform) }];
    }
    return [node];
  };
  return transform(structuredClone(doc))[0];
}

/** Plain text of a node (variables rendered as {{key}}), for tests and search. */
export function docToPlainText(node: TiptapNode): string {
  if (node.type === "text") return node.text || "";
  if (node.type === "templateVariable") return `{{${node.attrs?.key}}}`;
  if (node.type === "hardBreak") return "\n";
  if (node.type === "pageBreak") return "\n\f\n";
  const inner = (node.content || []).map(docToPlainText);
  const stacked = new Set(["doc", "bulletList", "orderedList", "listItem", "table", "tableRow", "tableCell", "tableHeader"]);
  return stacked.has(node.type) ? inner.join("\n") : inner.join("");
}
