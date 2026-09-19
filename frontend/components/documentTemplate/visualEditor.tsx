"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import {
  createTemplate,
  updateTemplate,
  getTemplate,
  getTemplateEditorContent,
  previewTemplateContentPdf,
  type DocumentTemplate,
  type TemplateEditorContent,
} from "@/app/utils/documentTemplateService";
import {
  getApiErrorMessage,
  getTemplateVariables,
} from "@/app/utils/docxTemplateService";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import useUnsavedChangesGuard from "@/app/hooks/useUnsavedChangesGuard";
import type {
  DocumentPageSettings,
  TemplateVariable,
} from "@/app/types/documentEditor.type";
import {
  TiptapDocumentEditor,
  type TiptapDocumentEditorHandle,
} from "@/components/documentTemplate/TiptapDocumentEditor";
import { DocumentPreviewOverlay } from "@/components/documentTemplate/DocumentPreviewOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, Eye, FileText, Loader2 } from "lucide-react";

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "barangayCertificate", label: "Barangay Certificate" },
  { value: "certificateOfResidency", label: "Certificate of Residency" },
  { value: "certificateOfIndigency", label: "Certificate of Indigency" },
  {
    value: "certificateOfGoodMoralCharacter",
    label: "Certificate of Good Moral Character",
  },
  { value: "certificateOfUnemployment", label: "Certificate of Unemployment" },
  { value: "barangayBusinessClearance", label: "Barangay Business Clearance" },
  { value: "certificateOfAttestation", label: "Certificate of Attestation" },
  {
    value: "certificationOfTreesCutting",
    label: "Certification of Trees Cutting",
  },
  { value: "barangayCertification", label: "Barangay Certification" },
  {
    value: "certificateOfFirstTimeJobseeker",
    label: "Certificate of First-Time Jobseeker",
  },
  { value: "firstTimeJobseekerOath", label: "First-Time Jobseeker Oath" },
  { value: "certificateOfLowIncome", label: "Certificate of Low Income" },
  { value: "endorsementLetter", label: "Endorsement Letter" },
];

const LIST_HREF = "/pages/secretary/document-templates";
const BLANK_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
const DEFAULT_MARGIN_PT = 56;
const MAX_SAVE_BYTES = 2_900_000;

type StoredPage = DocumentTemplate["page"];

const toEditorPage = (page?: Partial<StoredPage>): DocumentPageSettings => {
  const margins = page?.margins ?? {
    top: DEFAULT_MARGIN_PT,
    right: DEFAULT_MARGIN_PT,
    bottom: DEFAULT_MARGIN_PT,
    left: DEFAULT_MARGIN_PT,
  };
  return {
    size: page?.size === "LETTER" ? "Letter" : "A4",
    orientation: page?.orientation ?? "portrait",
    margins,
    background: page?.background || undefined,
    watermarkText: page?.watermark || undefined,
  };
};

const toStoredPage = (page: DocumentPageSettings): StoredPage => ({
  size: page.size === "Letter" ? "LETTER" : "A4",
  orientation: page.orientation ?? "portrait",
  unit: "pt",
  margins: page.margins,
  background: page.background ?? "",
  watermark: page.watermarkText ?? "",
});

const numberOr = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

interface TemplateEditorProps {
  isCreate: boolean;
  templateId?: string;
  onSaved: () => void;
}

/**
 * Visual/PDF template page: template details (name, type, fee, status…) around
 * the shared Tiptap document editor. Loads the template, converts legacy
 * layouts into an editable draft, and saves through the existing template API.
 */
export function TemplateEditor({
  isCreate,
  templateId,
  onSaved,
}: TemplateEditorProps) {
  const router = useRouter();

  const template = useQuery({
    queryKey: ["document-template", templateId],
    queryFn: () => getTemplate(templateId!),
    enabled: !!templateId,
    gcTime: 0,
  });
  const content = useQuery({
    queryKey: ["document-template-content", templateId],
    queryFn: () => getTemplateEditorContent(templateId!),
    enabled: !!templateId,
    gcTime: 0,
  });
  const variables = useQuery({
    queryKey: ["docx-template-variables"],
    queryFn: getTemplateVariables,
    staleTime: 5 * 60 * 1000,
  });

  const loading =
    (!isCreate && (template.isLoading || content.isLoading)) ||
    variables.isLoading;
  const failed =
    (!isCreate && (template.isError || content.isError)) || variables.isError;
  const backToList = () => router.push(LIST_HREF);

  if (loading || failed || (!isCreate && (!template.data || !content.data))) {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="flex flex-col items-center gap-4">
          {failed ? (
            <>
              <AlertTriangle className="size-6 text-amber-500" />
              <p className="text-sm text-muted-foreground">
                The template could not be loaded.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    template.refetch();
                    content.refetch();
                    variables.refetch();
                  }}
                >
                  Try again
                </Button>
                <Button size="sm" variant="outline" onClick={backToList}>
                  <ArrowLeft className="mr-1 size-4" /> Back to Document
                  Templates
                </Button>
              </div>
            </>
          ) : (
            <>
              <Loader2 className="size-6 animate-spin" />
              <span className="text-sm text-muted-foreground">
                Loading template...
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <VisualTemplateForm
      isCreate={isCreate}
      templateId={templateId}
      initial={template.data}
      initialContent={content.data}
      variables={variables.data ?? []}
      onSaved={onSaved}
    />
  );
}

function VisualTemplateForm({
  isCreate,
  templateId,
  initial,
  initialContent,
  variables,
  onSaved,
}: {
  isCreate: boolean;
  templateId?: string;
  initial?: DocumentTemplate;
  initialContent?: TemplateEditorContent;
  variables: TemplateVariable[];
  onSaved: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editorRef = useRef<TiptapDocumentEditorHandle>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [documentType, setDocumentType] = useState(initial?.documentType ?? "");
  const [fee, setFee] = useState(initial?.fee ?? 30);
  const [status, setStatus] = useState<"active" | "inactive">(
    initial?.status ?? "active",
  );
  const [page, setPage] = useState<DocumentPageSettings>(() =>
    toEditorPage(initial?.page),
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<JSONContent | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const converted = initialContent?.format === "legacy-converted";
  const currency = initial?.currency || "PHP";
  const touch = useCallback(() => setDirty(true), []);

  useUnsavedChangesGuard(dirty);

  // Free the object URL of a closed PDF preview.
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const leave = () => {
    if (!dirty) return router.push(LIST_HREF);
    confirmAlert(
      "You have unsaved changes that will be lost.",
      "Leave without saving",
      () => router.push(LIST_HREF),
    );
  };

  const save = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    if (!name.trim()) return errorAlert("Template name is required.");
    if (!documentType) return errorAlert("Please pick a document type.");
    const editorContent = editor.getJSON();
    if (JSON.stringify(editorContent).length > MAX_SAVE_BYTES) {
      return errorAlert(
        "This document is too large to save (about 3 MB max). Remove or shrink images and try again.",
      );
    }

    setSaving(true);
    try {
      const payload: Partial<DocumentTemplate> & {
        editorContent: JSONContent;
      } = {
        name,
        description,
        documentType,
        fee,
        currency,
        status,
        isDefault: initial?.isDefault ?? false,
        page: toStoredPage(page),
        contentFormat: "tiptap",
        editorContent,
      };
      if (isCreate) {
        await createTemplate(payload);
        successAlert("Template created successfully.");
      } else if (templateId) {
        await updateTemplate(templateId, payload);
        successAlert("Template saved successfully.");
      }
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      onSaved();
      router.push(LIST_HREF);
    } catch (error) {
      errorAlert(await getApiErrorMessage(error, "Failed to save template."));
    } finally {
      setSaving(false);
    }
  };

  const openPdfPreview = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    setPdfLoading(true);
    try {
      setPdfUrl(
        await previewTemplateContentPdf(editor.getJSON(), toStoredPage(page)),
      );
    } catch (error) {
      errorAlert(
        await getApiErrorMessage(error, "Could not generate a PDF preview."),
      );
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-80px)] flex-col overflow-hidden lg:h-dvh">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Template details */}
        <aside className="max-h-[38%] shrink-0 space-y-4 overflow-y-auto border-b bg-white p-4 lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              title="Back to Document Templates"
              onClick={leave}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h2 className="truncate text-lg font-bold">
              {isCreate ? "Create Template" : name || "Edit Template"}
            </h2>
            {!isCreate && initial ? (
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                v{initial.version}
              </span>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">Template Name</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                touch();
              }}
              placeholder="e.g. Barangay Certificate"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Description</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                touch();
              }}
              placeholder="Short description shown to residents"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select
                value={documentType}
                onValueChange={(v) => {
                  setDocumentType(v);
                  touch();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-fee">Fee ({currency})</Label>
              <Input
                id="tpl-fee"
                type="number"
                min={0}
                value={fee}
                onChange={(e) => {
                  setFee(Math.max(0, numberOr(e.target.value, 0)));
                  touch();
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as "active" | "inactive");
                touch();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="tpl-watermark"
              className="text-xs text-muted-foreground"
            >
              Watermark (optional)
            </Label>
            <Input
              id="tpl-watermark"
              value={page.watermarkText ?? ""}
              onChange={(e) => {
                setPage({ ...page, watermarkText: e.target.value });
                touch();
              }}
              placeholder="e.g. OFFICIAL COPY"
              className="h-8"
            />
            <p className="text-xs text-muted-foreground">
              Page size, orientation and margins are in the editor&apos;s Layout
              tab.
            </p>
          </div>
        </aside>

        {/* Shared Tiptap editor */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {converted ? (
            <div
              role="status"
              className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
            >
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  This template was made with the legacy layout builder. It has
                  been converted into an editable document, but exact positions
                  are not preserved — please review it. Nothing changes until
                  you save; until then PDFs keep using the original layout, and
                  the original layout stays stored after you save.
                </span>
              </p>
              {initialContent && initialContent.notes.length > 0 ? (
                <details className="mt-1 pl-6">
                  <summary className="cursor-pointer text-xs font-medium">
                    What was approximated ({initialContent.notes.length})
                  </summary>
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {initialContent.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <TiptapDocumentEditor
              ref={editorRef}
              value={initialContent?.editorContent ?? BLANK_DOC}
              onChange={touch}
              page={page}
              onPageChange={(next) => {
                setPage(next);
                touch();
              }}
              variables={variables}
              onSave={() => void save()}
              pageSizes={["A4", "Letter"]}
              allowOrientation
              placeholder="Start writing the document… use Insert Variable for {{fields}} that BIMS fills in."
            />
          </div>
        </main>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-white px-4 py-3">
        <Button variant="outline" onClick={leave}>
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              editorRef.current?.editor &&
              setPreview(editorRef.current.getJSON())
            }
          >
            <Eye className="mr-1 size-4" /> Preview
          </Button>
          <Button
            variant="outline"
            onClick={openPdfPreview}
            disabled={pdfLoading}
          >
            {pdfLoading ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <FileText className="mr-1 size-4" />
            )}{" "}
            PDF Preview
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isCreate ? "Create Template" : "Save Changes"}
          </Button>
        </div>
      </div>

      {preview ? (
        <DocumentPreviewOverlay
          doc={preview}
          page={page}
          title={name || "Untitled template"}
          onClose={() => setPreview(null)}
          onDownload={openPdfPreview}
          downloadLabel="PDF preview"
          downloading={pdfLoading}
        />
      ) : null}

      <Dialog open={!!pdfUrl} onOpenChange={(open) => !open && setPdfUrl(null)}>
        <DialogContent className="flex h-[80vh] flex-col sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              PDF preview — {name || "Untitled template"}
            </DialogTitle>
            <DialogDescription>
              Generated by the PDF engine with sample resident data. Save the
              template to use it for real requests.
            </DialogDescription>
          </DialogHeader>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full flex-1 rounded-lg border bg-white"
              title="PDF preview"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
