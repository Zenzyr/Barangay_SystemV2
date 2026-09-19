"use client";

import { useMemo, useRef, useState } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CaseUpper, Eraser, Highlighter, Image as ImageIcon,
  IndentDecrease, IndentIncrease, Italic, Link as LinkIcon, List, ListOrdered, Minus, Palette, Plus, Redo2,
  Scissors, Strikethrough, Subscript, Superscript, Table as TableIcon, Underline, Undo2, Variable,
} from "lucide-react";
import { errorAlert } from "@/app/utils/alert";
import type { DocumentPageSettings, DocumentPageSize, TemplateVariable } from "@/app/types/documentEditor.type";
import { Dropdown, ToolbarButton, ToolbarGroup } from "./ToolbarPrimitives";
import { TemplateVariablePicker } from "./TemplateVariablePicker";
import { ColorPicker } from "./ColorPicker";
import { PAGE_PT } from "./lib/pageMetrics";
import { INDENT_STEP_PT } from "./extensions/paragraphLayout";
import { SAFE_LINK } from "./extensions";

const FONTS = [
  "Calibri", "Times New Roman", "Arial", "Arial Narrow", "Bookman Old Style", "Bodoni MT", "Britannic Bold",
  "Century Gothic", "Engravers MT", "Hobo Std", "Berlin Sans FB Demi", "Georgia", "Verdana", "Courier New",
];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
const DEFAULT_FONT = "Calibri";
const DEFAULT_SIZE = 11;
const LINE_SPACINGS = [1, 1.15, 1.5, 2, 2.5, 3];

const MAX_IMAGE_BYTES = 1_200_000;
const MAX_IMAGE_DIMENSION = 1200;

type Tab = "home" | "insert" | "layout" | "table";

const cleanFont = (raw?: string | null) => (raw ? raw.split(",")[0].replace(/["']/g, "").trim() : "");

/** Reads an image file, downsizing large photos so the saved document stays small. */
async function imageToDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|gif)$/i.test(file.type)) throw new Error("Only PNG, JPEG or GIF images can be inserted.");
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });
  if (file.type === "image/gif") {
    if (file.size > MAX_IMAGE_BYTES) throw new Error("This GIF is too large (max ~1 MB).");
    return original;
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new window.Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not read the image."));
    el.src = original;
  });
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.width, img.height));
  if (scale === 1 && file.size <= MAX_IMAGE_BYTES) return original;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85);
  if (out.length * 0.75 > MAX_IMAGE_BYTES * 1.4) throw new Error("This image is too large. Please use a smaller image.");
  return out;
}

export function DocumentEditorToolbar({
  editor,
  variables,
  page,
  onPageChange,
  linkSignal,
  usedKeys,
  pageSizes = ["A4", "Letter", "Legal"],
  allowOrientation = false,
}: {
  editor: Editor;
  variables: TemplateVariable[];
  page: DocumentPageSettings;
  onPageChange: (page: DocumentPageSettings) => void;
  /** Bumped by the Ctrl/Cmd+K shortcut. */
  linkSignal: number;
  usedKeys: Set<string>;
  /** Page sizes the host can store (the PDF templates support A4 and Letter only). */
  pageSizes?: DocumentPageSize[];
  /** Show the portrait/landscape choice (only hosts whose backend stores it). */
  allowOrientation?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("home");
  // Ctrl/Cmd+K raises linkSignal; the Link panel (on Home) consumes it when it opens.
  const [consumedLinkSignal, setConsumedLinkSignal] = useState(0);
  const linkPending = linkSignal !== consumedLinkSignal;
  const fileInput = useRef<HTMLInputElement>(null);

  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const ts = e.getAttributes("textStyle");
      const para = e.getAttributes(e.isActive("heading") ? "heading" : "paragraph");
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        strike: e.isActive("strike"),
        subscript: e.isActive("subscript"),
        superscript: e.isActive("superscript"),
        caps: ts.textTransform === "uppercase",
        fontFamily: cleanFont(ts.fontFamily),
        fontSize: parseFloat(ts.fontSize) || 0,
        color: (ts.color as string) || null,
        highlight: (e.getAttributes("highlight").color as string) || null,
        align: (["left", "center", "right", "justify"] as const).find((a) => e.isActive({ textAlign: a })) || "left",
        heading: ([1, 2, 3, 4] as const).find((level) => e.isActive("heading", { level })) || 0,
        bulletList: e.isActive("bulletList"),
        orderedList: e.isActive("orderedList"),
        inList: e.isActive("listItem"),
        inTable: e.isActive("table"),
        borderless: e.getAttributes("table").borders === "none",
        lineHeight: parseFloat(para.lineHeight) || 1,
        link: (e.getAttributes("link").href as string) || "",
        canUndo: e.can().undo(),
        canRedo: e.can().redo(),
        canMerge: e.can().mergeCells(),
        canSplit: e.can().splitCell(),
      };
    },
  });

  // The Table tab exists only while the caret is in a table; a pending link request shows Home.
  const activeTab: Tab = linkPending || (tab === "table" && !s.inTable) ? "home" : tab;

  const chain = () => editor.chain().focus();
  const size = s.fontSize || DEFAULT_SIZE;
  const stepSize = (dir: 1 | -1) => {
    const next =
      dir === 1
        ? (SIZES.find((n) => n > size) ?? SIZES[SIZES.length - 1])
        : ([...SIZES].reverse().find((n) => n < size) ?? SIZES[0]);
    chain().setFontSize(`${next}pt`).run();
  };

  const indent = (dir: 1 | -1) => {
    if (s.inList) {
      if (dir === 1) chain().sinkListItem("listItem").run();
      else chain().liftListItem("listItem").run();
    } else {
      chain().indentParagraph(dir * INDENT_STEP_PT).run();
    }
  };

  const insertImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const src = await imageToDataUrl(file);
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const el = new window.Image();
        el.onload = () => resolve({ w: el.width, h: el.height });
        el.onerror = () => resolve({ w: 200, h: 200 });
        el.src = src;
      });
      const width = Math.min(dims.w, 240);
      chain().setImage({ src, alt: file.name, width, height: Math.round((width * dims.h) / dims.w) } as never).run();
    } catch (err) {
      errorAlert(err instanceof Error ? err.message : "Could not insert the image.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const tabs: { id: Tab; label: string }[] = useMemo(
    () => [
      { id: "home", label: "Home" },
      { id: "insert", label: "Insert" },
      { id: "layout", label: "Layout" },
      ...(s.inTable ? [{ id: "table" as Tab, label: "Table" }] : []),
    ],
    [s.inTable]
  );

  const setMargin = (side: keyof DocumentPageSettings["margins"], inches: number) => {
    const pt = Math.round(Math.min(3, Math.max(0, inches)) * 72);
    onPageChange({ ...page, margins: { ...page.margins, [side]: pt } });
  };

  return (
    <div className="border-b border-slate-200 bg-white">
      <div role="tablist" aria-label="Ribbon" className="flex gap-1 px-2 pt-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-3 py-1 text-sm ${
              activeTab === t.id ? "border-b-2 border-blue-600 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 bg-slate-50/70 px-2 py-1.5">
        {activeTab === "home" && (
          <>
            <ToolbarGroup label="History">
              <ToolbarButton icon={Undo2} label="Undo" shortcut="Ctrl+Z" onClick={() => chain().undo().run()} disabled={!s.canUndo} />
              <ToolbarButton icon={Redo2} label="Redo" shortcut="Ctrl+Shift+Z" onClick={() => chain().redo().run()} disabled={!s.canRedo} />
            </ToolbarGroup>

            <ToolbarGroup label="Font">
              <select
                aria-label="Paragraph style"
                value={s.heading}
                onChange={(e) => {
                  const level = Number(e.target.value);
                  if (level) chain().setHeading({ level: level as 1 | 2 | 3 | 4 }).run();
                  else chain().setParagraph().run();
                }}
                className="h-8 w-28 rounded-md border border-slate-200 bg-white px-1 text-sm"
              >
                <option value={0}>Normal</option>
                {[1, 2, 3, 4].map((l) => (
                  <option key={l} value={l}>{`Heading ${l}`}</option>
                ))}
              </select>
              <select
                aria-label="Font family"
                value={s.fontFamily || DEFAULT_FONT}
                onChange={(e) => chain().setFontFamily(e.target.value).run()}
                className="h-8 w-40 rounded-md border border-slate-200 bg-white px-1 text-sm"
              >
                {!FONTS.includes(s.fontFamily || DEFAULT_FONT) ? <option value={s.fontFamily}>{s.fontFamily}</option> : null}
                {FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                ))}
              </select>
              <ToolbarButton icon={Minus} label="Decrease font size" onClick={() => stepSize(-1)} />
              <select
                aria-label="Font size"
                value={size}
                onChange={(e) => chain().setFontSize(`${e.target.value}pt`).run()}
                className="h-8 w-16 rounded-md border border-slate-200 bg-white px-1 text-sm"
              >
                {!SIZES.includes(size) ? <option value={size}>{size}</option> : null}
                {SIZES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ToolbarButton icon={Plus} label="Increase font size" onClick={() => stepSize(1)} />
            </ToolbarGroup>

            <ToolbarGroup label="Text style">
              <ToolbarButton icon={Bold} label="Bold" shortcut="Ctrl+B" active={s.bold} onClick={() => chain().toggleBold().run()} />
              <ToolbarButton icon={Italic} label="Italic" shortcut="Ctrl+I" active={s.italic} onClick={() => chain().toggleItalic().run()} />
              <ToolbarButton icon={Underline} label="Underline" shortcut="Ctrl+U" active={s.underline} onClick={() => chain().toggleUnderline().run()} />
              <ToolbarButton icon={Strikethrough} label="Strikethrough" shortcut="Ctrl+Shift+S" active={s.strike} onClick={() => chain().toggleStrike().run()} />
              <ToolbarButton icon={Subscript} label="Subscript" shortcut="Ctrl+," active={s.subscript} onClick={() => chain().toggleSubscript().run()} />
              <ToolbarButton icon={Superscript} label="Superscript" shortcut="Ctrl+." active={s.superscript} onClick={() => chain().toggleSuperscript().run()} />
              <ToolbarButton
                icon={CaseUpper}
                label="All capitals"
                active={s.caps}
                onClick={() => (s.caps ? chain().updateAttributes("textStyle", { textTransform: null }).run() : chain().setMark("textStyle", { textTransform: "uppercase" }).run())}
              />
              <Dropdown
                label="Text colour"
                width={220}
                trigger={
                  <span className="flex flex-col items-center">
                    <Palette className="size-4" />
                    <span className="mt-px h-0.5 w-4 rounded" style={{ backgroundColor: s.color || "#000" }} />
                  </span>
                }
              >
                {(close) => (
                  <ColorPicker
                    label="Text colour"
                    current={s.color}
                    clearLabel="Automatic"
                    onPick={(c) => {
                      if (c) chain().setColor(c).run();
                      else chain().unsetColor().run();
                      close();
                    }}
                  />
                )}
              </Dropdown>
              <Dropdown
                label="Highlight colour"
                width={220}
                trigger={
                  <span className="flex flex-col items-center">
                    <Highlighter className="size-4" />
                    <span className="mt-px h-0.5 w-4 rounded" style={{ backgroundColor: s.highlight || "#ffff00" }} />
                  </span>
                }
              >
                {(close) => (
                  <ColorPicker
                    label="Highlight colour"
                    current={s.highlight}
                    clearLabel="No highlight"
                    onPick={(c) => {
                      if (c) chain().setHighlight({ color: c }).run();
                      else chain().unsetHighlight().run();
                      close();
                    }}
                  />
                )}
              </Dropdown>
              <ToolbarButton icon={Eraser} label="Clear text formatting" onClick={() => chain().unsetAllMarks().run()} />
            </ToolbarGroup>

            <ToolbarGroup label="Paragraph">
              <ToolbarButton icon={AlignLeft} label="Align left" shortcut="Ctrl+Shift+L" active={s.align === "left"} onClick={() => chain().setTextAlign("left").run()} />
              <ToolbarButton icon={AlignCenter} label="Center" shortcut="Ctrl+Shift+E" active={s.align === "center"} onClick={() => chain().setTextAlign("center").run()} />
              <ToolbarButton icon={AlignRight} label="Align right" shortcut="Ctrl+Shift+R" active={s.align === "right"} onClick={() => chain().setTextAlign("right").run()} />
              <ToolbarButton icon={AlignJustify} label="Justify" shortcut="Ctrl+Shift+J" active={s.align === "justify"} onClick={() => chain().setTextAlign("justify").run()} />
              <Dropdown
                label="Line and paragraph spacing"
                width={220}
                trigger={<span className="text-xs font-semibold tabular-nums">↕ {s.lineHeight}</span>}
              >
                {(close) => (
                  <div className="flex flex-col gap-0.5">
                    <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Line spacing</p>
                    {LINE_SPACINGS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          chain().setLineSpacing(n === 1 ? null : n).run();
                          close();
                        }}
                        className={`rounded px-2 py-1 text-left hover:bg-slate-100 ${s.lineHeight === n ? "font-semibold text-blue-700" : ""}`}
                      >
                        {n.toFixed(n % 1 ? 2 : 1).replace(/0$/, "")}
                      </button>
                    ))}
                    <p className="px-1 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Space after paragraph</p>
                    {[0, 6, 12, 18].map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          chain()
                            .updateAttributes("paragraph", { spaceAfter: pt ? `${pt}pt` : null })
                            .updateAttributes("heading", { spaceAfter: pt ? `${pt}pt` : null })
                            .run();
                          close();
                        }}
                        className="rounded px-2 py-1 text-left hover:bg-slate-100"
                      >
                        {pt} pt
                      </button>
                    ))}
                  </div>
                )}
              </Dropdown>
              <ToolbarButton icon={List} label="Bulleted list" shortcut="Ctrl+Shift+8" active={s.bulletList} onClick={() => chain().toggleBulletList().run()} />
              <ToolbarButton icon={ListOrdered} label="Numbered list" shortcut="Ctrl+Shift+7" active={s.orderedList} onClick={() => chain().toggleOrderedList().run()} />
              <ToolbarButton icon={IndentDecrease} label="Decrease indent" shortcut="Ctrl+[" onClick={() => indent(-1)} />
              <ToolbarButton icon={IndentIncrease} label="Increase indent" shortcut="Ctrl+]" onClick={() => indent(1)} />
            </ToolbarGroup>

            <ToolbarGroup label="Insert">
              <Dropdown label="Insert variable" width={340} trigger={<><Variable className="size-4" /><span className="hidden text-xs font-medium sm:inline">Variable</span></>}>
                {(close) => (
                  <TemplateVariablePicker
                    variables={variables}
                    usedKeys={usedKeys}
                    onInsert={(key) => {
                      chain().insertTemplateVariable(key).run();
                      close();
                    }}
                  />
                )}
              </Dropdown>
              <LinkMenu
                editor={editor}
                current={s.link}
                openSignal={linkPending ? linkSignal : 0}
                onOpened={() => {
                  setConsumedLinkSignal(linkSignal);
                  setTab("home");
                }}
              />
            </ToolbarGroup>
          </>
        )}

        {activeTab === "insert" && (
          <>
            <ToolbarGroup label="Variables">
              <Dropdown label="Insert variable" width={340} trigger={<><Variable className="size-4" /><span className="text-xs font-medium">Insert Variable</span></>}>
                {(close) => (
                  <TemplateVariablePicker
                    variables={variables}
                    usedKeys={usedKeys}
                    onInsert={(key) => {
                      chain().insertTemplateVariable(key).run();
                      close();
                    }}
                  />
                )}
              </Dropdown>
            </ToolbarGroup>
            <ToolbarGroup label="Objects">
              <Dropdown label="Insert table" width={230} trigger={<><TableIcon className="size-4" /><span className="text-xs font-medium">Table</span></>}>
                {(close) => <TablePicker onPick={(rows, cols) => (chain().insertTable({ rows, cols, withHeaderRow: false }).run(), close())} />}
              </Dropdown>
              <ToolbarButton icon={ImageIcon} label="Insert image" onClick={() => fileInput.current?.click()}>
                <span className="text-xs font-medium">Image</span>
              </ToolbarButton>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif" hidden onChange={(e) => insertImage(e.target.files?.[0])} />
              <LinkMenu editor={editor} current={s.link} openSignal={0} showLabel />
              <ToolbarButton icon={Minus} label="Horizontal line" onClick={() => chain().setHorizontalRule().run()}>
                <span className="text-xs font-medium">Line</span>
              </ToolbarButton>
              <ToolbarButton icon={Scissors} label="Page break" shortcut="Ctrl+Enter" onClick={() => chain().insertPageBreak().run()}>
                <span className="text-xs font-medium">Page break</span>
              </ToolbarButton>
            </ToolbarGroup>
          </>
        )}

        {activeTab === "layout" && (
          <>
            <ToolbarGroup label="Page setup">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                Size
                <select
                  aria-label="Page size"
                  value={page.size}
                  onChange={(e) => onPageChange({ ...page, size: e.target.value as DocumentPageSize })}
                  className="h-8 rounded-md border border-slate-200 bg-white px-1 text-sm text-slate-900"
                >
                  {pageSizes.map((k) => (
                    <option key={k} value={k}>{PAGE_PT[k].label}</option>
                  ))}
                </select>
              </label>
              {allowOrientation ? (
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  Orientation
                  <select
                    aria-label="Page orientation"
                    value={page.orientation ?? "portrait"}
                    onChange={(e) => onPageChange({ ...page, orientation: e.target.value as "portrait" | "landscape" })}
                    className="h-8 rounded-md border border-slate-200 bg-white px-1 text-sm text-slate-900"
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
              ) : null}
            </ToolbarGroup>
            <ToolbarGroup label="Margins (inches)">
              {(["top", "bottom", "left", "right"] as const).map((side) => (
                <label key={side} className="flex items-center gap-1 text-xs capitalize text-slate-600">
                  {side}
                  <input
                    type="number"
                    min={0}
                    max={3}
                    step={0.05}
                    aria-label={`${side} margin in inches`}
                    value={Number((page.margins[side] / 72).toFixed(2))}
                    onChange={(e) => e.target.value !== "" && setMargin(side, Number(e.target.value))}
                    className="h-8 w-16 rounded-md border border-slate-200 bg-white px-1 text-sm text-slate-900"
                  />
                </label>
              ))}
              <select
                aria-label="Margin presets"
                value=""
                onChange={(e) => {
                  const inches = Number(e.target.value);
                  if (inches) onPageChange({ ...page, margins: { top: inches * 72, right: inches * 72, bottom: inches * 72, left: inches * 72 } });
                }}
                className="h-8 rounded-md border border-slate-200 bg-white px-1 text-sm"
              >
                <option value="">Presets…</option>
                <option value="1">Normal (1&quot;)</option>
                <option value="0.5">Narrow (0.5&quot;)</option>
                <option value="1.25">Wide (1.25&quot;)</option>
              </select>
            </ToolbarGroup>
            <ToolbarGroup label="Breaks">
              <ToolbarButton icon={Scissors} label="Page break" shortcut="Ctrl+Enter" onClick={() => chain().insertPageBreak().run()}>
                <span className="text-xs font-medium">Page break</span>
              </ToolbarButton>
            </ToolbarGroup>
            <p className="basis-full px-1 text-[11px] text-slate-500">
              Page guides in the editor are approximate; explicit page breaks are exact in preview, print and the .docx export.
            </p>
          </>
        )}

        {activeTab === "table" && (
          <>
            <ToolbarGroup label="Rows">
              <ToolbarButton label="Insert row above" onClick={() => chain().addRowBefore().run()}><span className="text-xs">+ Row above</span></ToolbarButton>
              <ToolbarButton label="Insert row below" onClick={() => chain().addRowAfter().run()}><span className="text-xs">+ Row below</span></ToolbarButton>
              <ToolbarButton label="Delete row" onClick={() => chain().deleteRow().run()}><span className="text-xs">− Row</span></ToolbarButton>
            </ToolbarGroup>
            <ToolbarGroup label="Columns">
              <ToolbarButton label="Insert column left" onClick={() => chain().addColumnBefore().run()}><span className="text-xs">+ Col left</span></ToolbarButton>
              <ToolbarButton label="Insert column right" onClick={() => chain().addColumnAfter().run()}><span className="text-xs">+ Col right</span></ToolbarButton>
              <ToolbarButton label="Delete column" onClick={() => chain().deleteColumn().run()}><span className="text-xs">− Col</span></ToolbarButton>
            </ToolbarGroup>
            <ToolbarGroup label="Cells">
              <ToolbarButton label="Merge cells" disabled={!s.canMerge} onClick={() => chain().mergeCells().run()}><span className="text-xs">Merge</span></ToolbarButton>
              <ToolbarButton label="Split cell" disabled={!s.canSplit} onClick={() => chain().splitCell().run()}><span className="text-xs">Split</span></ToolbarButton>
              <ToolbarButton label="Toggle header row" onClick={() => chain().toggleHeaderRow().run()}><span className="text-xs">Header row</span></ToolbarButton>
              <ToolbarButton
                label={s.borderless ? "Show borders" : "Hide borders"}
                active={s.borderless}
                onClick={() => chain().updateAttributes("table", { borders: s.borderless ? "all" : "none" }).run()}
              >
                <span className="text-xs">No borders</span>
              </ToolbarButton>
            </ToolbarGroup>
            <ToolbarGroup label="Table">
              <ToolbarButton label="Delete table" onClick={() => chain().deleteTable().run()} className="text-red-600 hover:bg-red-50">
                <span className="text-xs">Delete table</span>
              </ToolbarButton>
            </ToolbarGroup>
          </>
        )}
      </div>
    </div>
  );
}

function TablePicker({ onPick }: { onPick: (rows: number, cols: number) => void }) {
  const [hover, setHover] = useState({ r: 0, c: 0 });
  return (
    <div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "repeat(8, 1fr)" }} onMouseLeave={() => setHover({ r: 0, c: 0 })}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8) + 1;
          const c = (i % 8) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              type="button"
              aria-label={`${r} by ${c} table`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHover({ r, c })}
              onFocus={() => setHover({ r, c })}
              onClick={() => onPick(r, c)}
              className={`aspect-square rounded-sm border ${on ? "border-blue-500 bg-blue-100" : "border-slate-300 bg-white"}`}
            />
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs text-slate-600">{hover.r ? `${hover.r} × ${hover.c} table` : "Choose table size"}</p>
    </div>
  );
}

function LinkMenu({
  editor,
  current,
  openSignal,
  onOpened,
  showLabel,
}: {
  editor: Editor;
  current: string;
  openSignal: number;
  onOpened?: () => void;
  showLabel?: boolean;
}) {
  const [url, setUrl] = useState("");

  const apply = (close: () => void) => {
    let value = url.trim();
    if (!value) return;
    if (!/^(https?:\/\/|mailto:|tel:)/i.test(value)) value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : `https://${value}`;
    if (!SAFE_LINK.test(value)) {
      errorAlert("Links must start with http://, https://, mailto: or tel:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    close();
  };

  return (
    <Dropdown
      label="Link"
      width={300}
      active={!!current}
      openSignal={openSignal}
      onOpenChange={(open) => {
        if (!open) return;
        setUrl(current);
        onOpened?.();
      }}
      trigger={<><LinkIcon className="size-4" />{showLabel ? <span className="text-xs font-medium">Link</span> : null}</>}
    >
      {(close) => (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply(close);
          }}
        >
          <label className="text-xs font-medium text-slate-600" htmlFor="link-url">Web address</label>
          <input
            id="link-url"
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-8 rounded-md border border-slate-200 px-2 text-sm outline-none focus:border-blue-400"
          />
          <div className="flex justify-end gap-2">
            {current ? (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  close();
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
              >
                Remove link
              </button>
            ) : null}
            <button type="submit" className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">
              Apply
            </button>
          </div>
        </form>
      )}
    </Dropdown>
  );
}
