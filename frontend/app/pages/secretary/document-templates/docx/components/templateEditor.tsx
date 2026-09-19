"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { downloadDocxTemplate, getApiErrorMessage, updateDocxTemplate } from "@/app/utils/docxTemplateService";
import useUnsavedChangesGuard from "@/app/hooks/useUnsavedChangesGuard";
import type { DocxPageSettings, DocxTemplate, TemplateVariable } from "@/app/types/docxTemplate.type";
import { buildExtensions } from "./extensions";
import { PaperSheet, ScaledStage, ZOOM_LEVELS, type Zoom } from "./paper";
import { Ribbon } from "./ribbon";
import { TopBar, type SaveState } from "./topBar";
import { PreviewOverlay } from "./previewOverlay";
import { pageMetricsPx } from "./lib/pageMetrics";
import { EditorContext } from "./lib/editorContext";
import "./editor.css";

const MAX_SAVE_BYTES = 2_900_000;
const BACK_HREF = "/pages/secretary/document-templates/docx";

function collectVariableKeys(node: JSONContent, into: Set<string> = new Set()): Set<string> {
  if (node.type === "templateVariable" && typeof node.attrs?.key === "string") into.add(node.attrs.key);
  node.content?.forEach((child) => collectVariableKeys(child, into));
  return into;
}

export function TemplateEditor({
  template,
  variables,
  startInPreview,
  onReload,
}: {
  template: DocxTemplate;
  variables: TemplateVariable[];
  startInPreview?: boolean;
  /** Re-fetch the template (used after a save conflict). */
  onReload: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const id = template._id;

  const [name, setName] = useState(template.name);
  const [page, setPage] = useState<DocxPageSettings>(template.page);
  const [version, setVersion] = useState(template.version);
  const [lastSaved, setLastSaved] = useState<Date | null>(template.updatedAt ? new Date(template.updatedAt) : null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [linkSignal, setLinkSignal] = useState(0);
  const [preview, setPreview] = useState<JSONContent | null>(null);
  const [pages, setPages] = useState(1);

  const editCounter = useRef(0);
  const knownKeys = useMemo(() => new Set(variables.map((v) => v.key)), [variables]);
  const contentRef = useRef<HTMLDivElement>(null);
  // Live page setup + variable registry for the (create-once) extensions.
  const [context] = useState(() => {
    const initial = new EditorContext();
    initial.update(knownKeys, pageMetricsPx(template.page)); // set before the editor first renders its chips
    return initial;
  });
  const extensions = useMemo(
    () => buildExtensions({ isKnownVariable: context.isKnown, getMetrics: context.getMetrics }),
    [context]
  );
  // Latest save/editor for keyboard handlers created once.
  const saveRef = useRef<() => void>(() => {});
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions,
    content: template.editorContent,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: { class: "doc-prose", "aria-label": "Document editor", "aria-multiline": "true" },
      handleKeyDown: (view, event) => {
        const mod = event.ctrlKey || event.metaKey;
        if (!mod || event.altKey) return false;
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          saveRef.current();
          return true;
        }
        if (key === "k") {
          event.preventDefault();
          setLinkSignal((n) => n + 1);
          return true;
        }
        if (key === "]" || key === "[") {
          event.preventDefault();
          const inList = view.state.selection.$from.node(-1)?.type.name === "listItem";
          const cmd = editorRef.current;
          if (!cmd) return true;
          if (!inList) cmd.chain().focus().indentParagraph(key === "]" ? 36 : -36).run();
          else if (key === "]") cmd.chain().focus().sinkListItem("listItem").run();
          else cmd.chain().focus().liftListItem("listItem").run();
          return true;
        }
        return false;
      },
    },
    onUpdate: () => {
      editCounter.current += 1;
      setDirty(true);
    },
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? { keys: Array.from(collectVariableKeys(e.getJSON())), words: e.storage.characterCount.words(), characters: e.storage.characterCount.characters() }
        : { keys: [] as string[], words: 0, characters: 0 },
  });
  const usedKeys = useMemo(() => new Set(stats?.keys ?? []), [stats?.keys]);

  // Keep the extensions' live config current and re-flow explicit page breaks when it changes.
  useEffect(() => {
    context.update(knownKeys, pageMetricsPx(page));
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta("pageSetup", true));
  }, [context, knownKeys, editor, page]);

  // How many printed pages the continuous canvas spans (for page guides and backdrops).
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      const m = pageMetricsPx(page);
      const total = el.offsetHeight + m.margins.top + m.margins.bottom;
      setPages(Math.max(1, Math.ceil((total - 2) / m.height)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
    // `editor` matters: the paper (and contentRef) only mounts once the editor exists.
  }, [page, editor]);

  // Ctrl/Cmd+S anywhere on the page (not only inside the document).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // After a conflict the edits cannot be saved as-is, but leaving still discards them.
  useUnsavedChangesGuard(
    dirty,
    conflict ? "You have unsaved changes that could not be saved because the template changed elsewhere." : undefined
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!editor || saving) return false;
    const trimmed = name.trim();
    if (!trimmed) {
      errorAlert("Template name is required.");
      return false;
    }
    const content = editor.getJSON();
    if (JSON.stringify(content).length > MAX_SAVE_BYTES) {
      errorAlert("This document is too large to save (about 3 MB max). Remove or shrink images and try again.");
      return false;
    }

    const startedAt = editCounter.current;
    setSaving(true);
    try {
      const saved = await updateDocxTemplate(id, {
        name: trimmed,
        editorContent: content,
        page: { size: page.size, margins: page.margins },
        expectedVersion: version,
      });
      setVersion(saved.version);
      setLastSaved(new Date(saved.updatedAt));
      setName(saved.name);
      // Edits made while the request was in flight are still unsaved.
      setDirty(editCounter.current !== startedAt);
      setConflict(false);
      queryClient.invalidateQueries({ queryKey: ["docx-templates"] });
      successAlert("Template saved.");
      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) setConflict(true);
      errorAlert(await getApiErrorMessage(error, "Failed to save the template."));
      return false;
    } finally {
      setSaving(false);
    }
  }, [editor, saving, name, id, page.size, page.margins, version, queryClient]);
  useEffect(() => {
    saveRef.current = () => void save();
  }, [save]);

  const download = useCallback(async () => {
    if (!editor || downloading) return;
    setDownloading(true);
    try {
      const warnings = await downloadDocxTemplate(id, name.trim() || "template", {
        editorContent: editor.getJSON(),
        name: name.trim() || undefined,
      });
      successAlert(dirty ? "Downloaded the current (unsaved) content as .docx." : "Downloaded as .docx.");
      if (warnings.length) errorAlert(`Some elements were left out of the .docx: ${warnings.join("; ")}`);
    } catch (error) {
      errorAlert(await getApiErrorMessage(error, "Failed to export the template."));
    } finally {
      setDownloading(false);
    }
  }, [editor, downloading, id, name, dirty]);

  const openPreview = useCallback(() => {
    if (editor) setPreview(editor.getJSON());
  }, [editor]);

  // ?preview=1 opens straight into preview once the editor exists.
  const startedPreview = useRef(false);
  useEffect(() => {
    if (startInPreview && editor && !startedPreview.current) {
      startedPreview.current = true;
      setPreview(editor.getJSON());
    }
  }, [startInPreview, editor]);

  const printFromMenu = useCallback(() => {
    openPreview();
    setTimeout(() => window.print(), 600);
  }, [openPreview]);

  const state: SaveState = saving ? "saving" : conflict ? "conflict" : dirty ? "dirty" : "saved";
  const metrics = pageMetricsPx(page);

  if (!editor) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading editor…</div>;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <TopBar
        name={name}
        onNameChange={(value) => {
          setName(value);
          setDirty(true);
        }}
        state={state}
        lastSaved={lastSaved}
        version={version}
        saving={saving}
        onSave={() => void save()}
        onPreview={openPreview}
        onPrint={printFromMenu}
        onDownload={() => void download()}
        downloading={downloading}
        backHref={BACK_HREF}
      />

      {conflict ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <span>This template was changed by someone else after you opened it. Saving is blocked so their work is not overwritten.</span>
          <button type="button" onClick={onReload} className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-100">
            Discard my edits and reload
          </button>
        </div>
      ) : null}

      <Ribbon
        editor={editor}
        variables={variables}
        page={page}
        onPageChange={(next) => {
          setPage(next);
          setDirty(true);
        }}
        linkSignal={linkSignal}
        usedKeys={usedKeys}
      />

      <div className="doc-workspace doc-editing min-h-0 flex-1 overflow-auto px-2 py-6 sm:px-6" onClick={(e) => e.target === e.currentTarget && editor.commands.focus("end")}>
        <ScaledStage paperWidth={metrics.width} zoom={zoom}>
          <PaperSheet page={page} pages={pages} guides contentRef={contentRef}>
            <EditorContent editor={editor} />
          </PaperSheet>
        </ScaledStage>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
        <span>
          Page setup: {page.size} · {pages} {pages === 1 ? "page" : "pages"} · {stats?.words ?? 0} words · {stats?.characters ?? 0} characters · {usedKeys.size} variable
          {usedKeys.size === 1 ? "" : "s"}
        </span>
        <label className="flex items-center gap-1.5">
          Zoom
          <select
            aria-label="Zoom"
            value={String(zoom)}
            onChange={(e) => setZoom(e.target.value === "fit" ? "fit" : (Number(e.target.value) as Zoom))}
            className="h-6 rounded border border-slate-200 bg-white px-1 text-xs"
          >
            <option value="fit">Fit width</option>
            {ZOOM_LEVELS.map((z) => (
              <option key={z} value={z}>
                {Math.round(z * 100)}%
              </option>
            ))}
          </select>
        </label>
      </div>

      {preview ? (
        <PreviewOverlay
          doc={preview}
          page={page}
          title={name || template.name}
          onClose={() => setPreview(null)}
          onDownload={() => void download()}
          downloading={downloading}
        />
      ) : null}
    </div>
  );
}
