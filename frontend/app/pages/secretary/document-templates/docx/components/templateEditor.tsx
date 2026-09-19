"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  downloadDocxTemplate,
  getApiErrorMessage,
  updateDocxTemplate,
} from "@/app/utils/docxTemplateService";
import useUnsavedChangesGuard from "@/app/hooks/useUnsavedChangesGuard";
import type { DocxTemplate } from "@/app/types/docxTemplate.type";
import type {
  DocumentPageSettings,
  TemplateVariable,
} from "@/app/types/documentEditor.type";
import {
  TiptapDocumentEditor,
  type TiptapDocumentEditorHandle,
} from "@/components/documentTemplate/TiptapDocumentEditor";
import { DocumentPreviewOverlay } from "@/components/documentTemplate/DocumentPreviewOverlay";
import { TopBar, type SaveState } from "./topBar";

const MAX_SAVE_BYTES = 2_900_000;
const BACK_HREF = "/pages/secretary/document-templates/docx";

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
  const editorRef = useRef<TiptapDocumentEditorHandle>(null);

  const [name, setName] = useState(template.name);
  const [page, setPage] = useState<DocumentPageSettings>(template.page);
  const [version, setVersion] = useState(template.version);
  const [lastSaved, setLastSaved] = useState<Date | null>(
    template.updatedAt ? new Date(template.updatedAt) : null,
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<JSONContent | null>(null);
  const editCounter = useRef(0);

  const markEdited = useCallback(() => {
    editCounter.current += 1;
    setDirty(true);
  }, []);

  // After a conflict the edits cannot be saved as-is, but leaving still discards them.
  useUnsavedChangesGuard(
    dirty,
    conflict
      ? "You have unsaved changes that could not be saved because the template changed elsewhere."
      : undefined,
  );

  const save = useCallback(async (): Promise<boolean> => {
    const editor = editorRef.current;
    if (!editor || saving) return false;
    const trimmed = name.trim();
    if (!trimmed) {
      errorAlert("Template name is required.");
      return false;
    }
    const content = editor.getJSON();
    if (JSON.stringify(content).length > MAX_SAVE_BYTES) {
      errorAlert(
        "This document is too large to save (about 3 MB max). Remove or shrink images and try again.",
      );
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
      if (axios.isAxiosError(error) && error.response?.status === 409)
        setConflict(true);
      errorAlert(
        await getApiErrorMessage(error, "Failed to save the template."),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [saving, name, id, page.size, page.margins, version, queryClient]);

  const download = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || downloading) return;
    setDownloading(true);
    try {
      const warnings = await downloadDocxTemplate(
        id,
        name.trim() || "template",
        {
          editorContent: editor.getJSON(),
          name: name.trim() || undefined,
        },
      );
      successAlert(
        dirty
          ? "Downloaded the current (unsaved) content as .docx."
          : "Downloaded as .docx.",
      );
      if (warnings.length)
        errorAlert(
          `Some elements were left out of the .docx: ${warnings.join("; ")}`,
        );
    } catch (error) {
      errorAlert(
        await getApiErrorMessage(error, "Failed to export the template."),
      );
    } finally {
      setDownloading(false);
    }
  }, [downloading, id, name, dirty]);

  const openPreview = useCallback(() => {
    const editor = editorRef.current;
    if (editor) setPreview(editor.getJSON());
  }, []);

  // ?preview=1 opens straight into preview once the editor has mounted.
  const startedPreview = useRef(false);
  useEffect(() => {
    if (!startInPreview || startedPreview.current) return;
    const timer = setInterval(() => {
      const editor = editorRef.current?.editor;
      if (editor && !startedPreview.current) {
        startedPreview.current = true;
        setPreview(editor.getJSON());
        clearInterval(timer);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [startInPreview]);

  const printFromMenu = useCallback(() => {
    openPreview();
    setTimeout(() => window.print(), 600);
  }, [openPreview]);

  const state: SaveState = saving
    ? "saving"
    : conflict
      ? "conflict"
      : dirty
        ? "dirty"
        : "saved";

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <TopBar
        name={name}
        onNameChange={(value) => {
          setName(value);
          markEdited();
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
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <span>
            This template was changed by someone else after you opened it.
            Saving is blocked so their work is not overwritten.
          </span>
          <button
            type="button"
            onClick={onReload}
            className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium hover:bg-red-100"
          >
            Discard my edits and reload
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <TiptapDocumentEditor
          ref={editorRef}
          value={template.editorContent}
          onChange={markEdited}
          page={page}
          onPageChange={(next) => {
            setPage(next);
            markEdited();
          }}
          variables={variables}
          onSave={() => void save()}
        />
      </div>

      {preview ? (
        <DocumentPreviewOverlay
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
