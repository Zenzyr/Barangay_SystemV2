// Dependency-free OOXML (WordprocessingML) placeholder replacement inside a
// document.xml package part. Where the Tiptap editor path works on JSON nodes,
// this works on the raw XML a Word template stores. The tricky case it exists
// for: Word splits one logical piece of text across several <w:r><w:t> runs
// (formatting changes, proofing bookmarks, spell-check toggles), so a
// {{variable}} typed in Word often spans more than one <w:t> element. Only the
// inner text of <w:t> nodes is edited — run properties and everything else in
// the paragraph survive untouched.

// Must mirror tiptapDoc.ts's LITERAL_VARIABLE so both renderers agree on what
// a placeholder looks like.
const PLACEHOLDER = /\{\{([a-z][a-z0-9_]{0,63})\}\}/g;

// Wordparagraph open tag (<w:p> or <w:p attrs>). The \b keeps <w:pPr>,
// <w:pBdr>, etc. out.
const PARAGRAPH_OPEN = /<w:p(?=[\s>])/g;
const PARAGRAPH_CLOSE = /<\/w:p>/g;

// <w:t ...>text</w:t> (inner text can never contain a raw '<' in valid XML).
const W_T = /<w:t\b([^>]*)>([^<]*)<\/w:t>/g;

/** XML-escapes a value before it is placed inside a <w:t> element. */
export function escapeXmlText(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" } as Record<string, string>)[ch]
  );
}

interface WtNode {
  /** Relative index of the '<w:t' open tag inside the paragraph slice. */
  openTagStart: number;
  /** Relative index just past the open tag's '>'. */
  innerStart: number;
  /** Relative index of the '<' of '</w:t>'. */
  innerEnd: number;
  openAttrs: string;
  text: string;
}

/** The node whose text contains the combined-stream offset `x`, or null. */
function nodeAt(nodes: WtNode[], cum: number[], x: number): number | null {
  for (let i = 0; i < nodes.length; i++) {
    if (x >= cum[i] && x < cum[i] + nodes[i].text.length) return i;
  }
  return null;
}

/** Applies non-overlapping edits to a node's original text (right-to-left). */
function applyNodeEdits(text: string, edits: Array<{ s: number; e: number; insert: string }>): string {
  let cur = text;
  for (const ed of [...edits].sort((a, b) => b.s - a.s)) {
    if (ed.s < 0 || ed.e > cur.length || ed.s > ed.e) continue;
    cur = cur.slice(0, ed.s) + ed.insert + cur.slice(ed.e);
  }
  return cur;
}

/** Ensures leading/trailing whitespace survives Word's trimming. */
function withSpacePreserve(openAttrs: string): string {
  if (/xml\:space\s*=\s*"preserve"/.test(openAttrs)) return openAttrs;
  return ` xml:space="preserve"`;
}

/**
 * Replaces {{variables}} in a document.xml body, handling placeholders split
 * across any number of <w:r>/<w:t> runs. Values are XML-escaped; unknown
 * variables are left visible as {{key}} (matching the editor renderer). The
 * replacement takes the formatting of the run where the variable starts.
 */
export function replacePlaceholdersInDocumentXml(xml: string, values: Record<string, string>): string {
  if (!values || Object.keys(values).length === 0) return xml;
  // Placeholders may be split across runs, so "{{" alone is the cheapest
  // reliable "any placeholder present" signal at the raw-XML level.
  if (!/\{\{/.test(xml)) return xml;

  // Pair every <w:p> with its matching </w:p> using a stack, so nested
  // paragraphs (e.g. inside <w:txbxContent>) resolve correctly.
  const events: Array<{ pos: number; type: "open" | "close" }> = [];
  PARAGRAPH_OPEN.lastIndex = 0;
  for (const m of xml.matchAll(PARAGRAPH_OPEN)) events.push({ pos: m.index as number, type: "open" });
  PARAGRAPH_CLOSE.lastIndex = 0;
  for (const m of xml.matchAll(PARAGRAPH_CLOSE))
    events.push({ pos: m.index as number, type: "close" });
  events.sort((a, b) => a.pos - b.pos);

  const pairs: Array<[number, number]> = [];
  const openStack: number[] = [];
  for (const ev of events) {
    if (ev.type === "open") openStack.push(ev.pos);
    else {
      const open = openStack.pop();
      if (open !== undefined) pairs.push([open, ev.pos + "</w:p>".length]);
    }
  }

  // Only top-level paragraphs are processed as standalone text streams; nested
  // ones (text boxes) stay byte-for-byte as stored. A paragraph is top-level
  // when no other pair strictly contains its open tag.
  const topLevel = pairs.filter(
    ([o]) => !pairs.some(([o2, c2]) => o2 < o && o < c2)
  );
  if (topLevel.length === 0) return xml;

  let out = "";
  let cursor = 0;
  for (const [open, close] of topLevel) {
    const paragraph = xml.slice(open, close);
    const rebuilt = rebuildParagraph(paragraph, values);
    out += xml.slice(cursor, open) + rebuilt;
    cursor = close;
  }
  out += xml.slice(cursor);
  return out;
}

function rebuildParagraph(paragraph: string, values: Record<string, string>): string {
  const nodes: WtNode[] = [];
  W_T.lastIndex = 0;
  for (const m of paragraph.matchAll(W_T)) {
    const openTagStart = m.index as number;
    const openAttrs = m[1];
    const text = m[2];
    const innerStart = openTagStart + `<w:t${openAttrs}`.length + 1;
    const innerEnd = openTagStart + m[0].length - "</w:t>".length;
    nodes.push({ openTagStart, innerStart, innerEnd, openAttrs, text });
  }
  if (nodes.length === 0) return paragraph;

  const cum: number[] = [];
  let total = 0;
  for (const n of nodes) {
    cum.push(total);
    total += n.text.length;
  }
  if (!/\{\{/.test(nodes.map((n) => n.text).join(""))) return paragraph;

  const combined = nodes.map((n) => n.text).join("");
  const edits: Array<Array<{ s: number; e: number; insert: string }>> = nodes.map(() => []);

  PLACEHOLDER.lastIndex = 0;
  for (const m of combined.matchAll(PLACEHOLDER)) {
    const key = m[1];
    if (values[key] === undefined) continue;
    const insert = escapeXmlText(values[key]);
    const ms = m.index as number;
    const me = m.index + m[0].length;

    const i0 = nodeAt(nodes, cum, ms);
    if (i0 === null) continue;
    const i1 = nodeAt(nodes, cum, me - 1);
    if (i1 === null) continue;

    const s0 = ms - cum[i0];
    const e0 = i0 === i1 ? me - cum[i0] : nodes[i0].text.length;
    edits[i0].push({ s: s0, e: e0, insert });

    if (i1 > i0) {
      for (let k = i0 + 1; k < i1; k++) {
        edits[k].push({ s: 0, e: nodes[k].text.length, insert: "" });
      }
      edits[i1].push({ s: 0, e: me - cum[i1], insert: "" });
    }
  }

  // Rebuild from the back so earlier open tags keep their positions.
  let rebuilt = paragraph;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const ed = edits[i];
    if (ed.length === 0) continue;
    const node = nodes[i];
    const newText = applyNodeEdits(node.text, ed);
    const attrs =
      newText.trim() !== newText && /^\s|\s$/.test(newText) ? withSpacePreserve(node.openAttrs) : node.openAttrs;
    rebuilt = rebuilt.slice(0, node.openTagStart) + `<w:t${attrs}>` + newText + rebuilt.slice(node.innerEnd);
  }
  return rebuilt;
}