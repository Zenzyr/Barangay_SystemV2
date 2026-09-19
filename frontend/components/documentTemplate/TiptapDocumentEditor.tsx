"use client";

import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  EditorContent,
  useEditor,
  useEditorState,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import type {
  DocumentPageSettings,
  DocumentPageSize,
  TemplateVariable,
} from "@/app/types/documentEditor.type";
import { buildExtensions } from "./extensions";
import { EditorContext } from "./lib/editorContext";
import { pageMetricsPx } from "./lib/pageMetrics";
import { DocumentEditorToolbar } from "./DocumentEditorToolbar";
import {
  PaperSheet,
  ScaledStage,
  ZOOM_LEVELS,
  type Zoom,
} from "./DocumentPaper";
import "./editor.css";

export interface TiptapDocumentEditorHandle {
  editor: Editor | null;
  getJSON: () => JSONContent;
}

export interface TiptapDocumentEditorProps {
  value: JSONContent;
  onChange?: (content: JSONContent) => void;
  page: DocumentPageSettings;
  onPageChange?: (page: DocumentPageSettings) => void;
  variables: TemplateVariable[];
  editable?: boolean;
  placeholder?: string;
  className?: string;
  onSave?: () => void;
  pageSizes?: DocumentPageSize[];
  allowOrientation?: boolean;
  ref?: Ref<TiptapDocumentEditorHandle>;
}

function collectVariableKeys(
  node: JSONContent,
  into: Set<string> = new Set(),
): Set<string> {
  if (node.type === "templateVariable" && typeof node.attrs?.key === "string")
    into.add(node.attrs.key);
  node.content?.forEach((child) => collectVariableKeys(child, into));
  return into;
}

export function TiptapDocumentEditor({
  value,
  onChange,
  page,
  onPageChange,
  variables,
  editable = true,
  placeholder,
  className = "",
  onSave,
  pageSizes,
  allowOrientation,
  ref,
}: TiptapDocumentEditorProps) {
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [linkSignal, setLinkSignal] = useState(0);
  const [pages, setPages] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);

  const knownKeys = useMemo(
    () => new Set(variables.map((v) => v.key)),
    [variables],
  );
  const [context] = useState(() => {
    const initial = new EditorContext();
    initial.update(knownKeys, pageMetricsPx(page));
    return initial;
  });
  const extensions = useMemo(
    () =>
      buildExtensions({
        isKnownVariable: context.isKnown,
        getMetrics: context.getMetrics,
        placeholder,
      }),
    [context],
  );

  const saveRef = useRef(onSave);
  const changeRef = useRef(onChange);
  const editorRef = useRef<Editor | null>(null);
  useEffect(() => {
    saveRef.current = onSave;
    changeRef.current = onChange;
  }, [onSave, onChange]);

  const editor = useEditor({
    extensions,
    content: value,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: "doc-prose",
        "aria-label": "Document editor",
        "aria-multiline": "true",
      },
      handleKeyDown: (view, event) => {
        const mod = event.ctrlKey || event.metaKey;
        if (!mod || event.altKey) return false;
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          saveRef.current?.();
          return true;
        }
        if (key === "k") {
          event.preventDefault();
          setLinkSignal((n) => n + 1);
          return true;
        }
        if (key === "]" || key === "[") {
          event.preventDefault();
          const inList =
            view.state.selection.$from.node(-1)?.type.name === "listItem";
          const cmd = editorRef.current;
          if (!cmd) return true;
          if (!inList)
            cmd
              .chain()
              .focus()
              .indentParagraph(key === "]" ? 36 : -36)
              .run();
          else if (key === "]")
            cmd.chain().focus().sinkListItem("listItem").run();
          else cmd.chain().focus().liftListItem("listItem").run();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => changeRef.current?.(e.getJSON()),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({ editor, getJSON: () => editor?.getJSON() ?? value }),
    [editor, value],
  );

  useEffect(() => {
    if (editor && !editor.isDestroyed && editor.isEditable !== editable)
      editor.setEditable(editable, false);
  }, [editor, editable]);

  const stats = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            keys: Array.from(collectVariableKeys(e.getJSON())),
            words: e.storage.characterCount.words(),
            characters: e.storage.characterCount.characters(),
          }
        : { keys: [] as string[], words: 0, characters: 0 },
  });
  const usedKeys = useMemo(() => new Set(stats?.keys ?? []), [stats?.keys]);

  useEffect(() => {
    context.update(knownKeys, pageMetricsPx(page));
    if (editor && !editor.isDestroyed)
      editor.view.dispatch(editor.state.tr.setMeta("pageSetup", true));
  }, [context, knownKeys, editor, page]);

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
  }, [page, editor]);

  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        e.key.toLowerCase() === "s" &&
        saveRef.current
      ) {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editable]);

  if (!editor) {
    return (
      <div
        className={`flex h-full items-center justify-center text-sm text-slate-500 ${className}`}
      >
        Loading editor…
      </div>
    );
  }

  const metrics = pageMetricsPx(page);
  const orientation =
    page.orientation === "landscape" ? "landscape" : "portrait";

  return (
    <div className={`flex h-full min-h-0 flex-col bg-white ${className}`}>
      {editable ? (
        <DocumentEditorToolbar
          editor={editor}
          variables={variables}
          page={page}
          onPageChange={(next) => onPageChange?.(next)}
          linkSignal={linkSignal}
          usedKeys={usedKeys}
          pageSizes={pageSizes}
          allowOrientation={allowOrientation && !!onPageChange}
        />
      ) : null}

      <div
        className={`doc-workspace min-h-0 flex-1 overflow-auto px-2 py-6 sm:px-6 ${editable ? "doc-editing" : ""}`}
        onClick={(e) =>
          editable &&
          e.target === e.currentTarget &&
          editor.commands.focus("end")
        }
      >
        <ScaledStage paperWidth={metrics.width} zoom={zoom}>
          <PaperSheet page={page} pages={pages} guides contentRef={contentRef}>
            <EditorContent editor={editor} />
          </PaperSheet>
        </ScaledStage>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
        <span>
          {page.size} {orientation === "landscape" ? "landscape" : ""} · {pages}{" "}
          {pages === 1 ? "page" : "pages"} · {stats?.words ?? 0} words ·{" "}
          {stats?.characters ?? 0} characters · {usedKeys.size} variable
          {usedKeys.size === 1 ? "" : "s"}
        </span>
        <label className="flex items-center gap-1.5">
          Zoom
          <select
            aria-label="Zoom"
            value={String(zoom)}
            onChange={(e) =>
              setZoom(
                e.target.value === "fit"
                  ? "fit"
                  : (Number(e.target.value) as Zoom),
              )
            }
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
    </div>
  );
}
