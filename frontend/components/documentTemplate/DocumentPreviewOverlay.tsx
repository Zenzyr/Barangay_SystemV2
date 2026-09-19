"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DocumentPageSettings } from "@/app/types/documentEditor.type";
import { buildExtensions } from "./extensions";
import { PaperSheet, ScaledStage } from "./DocumentPaper";
import { pageMetricsPx, pageSizePt } from "./lib/pageMetrics";
import "./editor.css";

/** Splits a document into sheets at explicit page breaks. */
export function splitIntoSheets(doc: JSONContent): JSONContent[] {
  const sheets: JSONContent[][] = [[]];
  for (const node of doc.content ?? []) {
    if (node.type === "pageBreak") sheets.push([]);
    else sheets[sheets.length - 1].push(node);
  }
  return sheets.map((content) => ({
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  }));
}

const noopMetrics = () => ({ pageHeight: 0, topMargin: 0 });

function Sheet({
  doc,
  page,
}: {
  doc: JSONContent;
  page: DocumentPageSettings;
}) {
  const extensions = useMemo(
    () =>
      buildExtensions({
        isKnownVariable: () => true,
        getMetrics: noopMetrics,
        readOnly: true,
      }),
    [],
  );
  const editor = useEditor({
    extensions,
    content: doc,
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "doc-prose" } },
  });

  useEffect(() => {
    editor?.commands.setContent(doc, { emitUpdate: false });
  }, [editor, doc]);

  const width = pageMetricsPx(page).width;
  return (
    <ScaledStage paperWidth={width} wrapClassName="mb-6">
      <PaperSheet page={page} className="print-sheet">
        <EditorContent editor={editor} />
      </PaperSheet>
    </ScaledStage>
  );
}

/**
 * Full-screen preview: each sheet is a real page (page size, margins, page
 * background/watermark, explicit page breaks). Print uses the browser's print
 * dialog, which also offers "Save as PDF".
 */
export function DocumentPreviewOverlay({
  doc,
  page,
  title,
  onClose,
  onDownload,
  downloadLabel = "Download .docx",
  downloading,
}: {
  doc: JSONContent;
  page: DocumentPageSettings;
  title: string;
  onClose: () => void;
  /** Primary action shown next to Print (the host decides what it produces). */
  onDownload: () => void;
  downloadLabel?: string;
  downloading: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sheets = useMemo(() => splitIntoSheets(doc), [doc]);
  const size = pageSizePt(page);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="print-root fixed inset-0 z-[90] flex flex-col bg-slate-100"
      role="dialog"
      aria-label={`Preview of ${title}`}
    >
      {/* Sets the printed page size to match the template. */}
      <style>{`@media print { @page { size: ${size.w}pt ${size.h}pt; margin: 0; } }`}</style>
      <div className="print-hide flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            <ArrowLeft className="mr-1 size-4" /> Back to editing
          </Button>
          <span className="truncate text-sm font-medium text-slate-800">
            Preview — {title}
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            {sheets.length} {sheets.length === 1 ? "page" : "pages"} ·{" "}
            {page.size}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 size-4" /> Print
          </Button>
          <Button size="sm" onClick={onDownload} disabled={downloading}>
            <Download className="mr-1 size-4" />{" "}
            {downloading ? "Working…" : downloadLabel}
          </Button>
        </div>
      </div>
      <div className="print-scroll doc-workspace doc-preview flex-1 overflow-auto px-2 py-6 sm:px-6">
        {sheets.map((sheet, index) => (
          <Sheet key={index} doc={sheet} page={page} />
        ))}
        <p className="print-hide pb-6 text-center text-xs text-slate-500">
          Variables such as {"{{resident_name}}"} are filled in when a document
          is generated from a request.
        </p>
      </div>
    </div>,
    document.body,
  );
}
