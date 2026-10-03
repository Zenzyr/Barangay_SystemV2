"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit, Eye, Plus, RefreshCcw, Search, Sparkles, Trash2, X } from "lucide-react";
import {
  deleteTemplate,
  duplicateTemplate,
  fetchTemplatePreviewPdf,
  getTemplates,
  seedTemplates,
  type DocumentTemplate,
} from "@/app/utils/documentTemplateService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { DOCUMENT_NAMES } from "@/app/utils/documentRequestOptions";
import { formatPeso, PriceStatusBadge } from "./PendingPriceApprovals";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
};

const PAGE_SIZES: Record<string, string> = {
  A4: "A4",
  LETTER: "Letter",
};

const PAGE_DIMS: Record<string, { w: number; h: number }> = {
  A4: { w: 595, h: 842 },
  LETTER: { w: 612, h: 792 },
};

export function DocumentTemplateList({
  createHref,
  editHref,
}: {
  createHref: string;
  editHref: (id: string) => string;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [preview, setPreview] = useState<{ id: string; name: string; url: string } | null>(null);

  const { data: templates = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["document-templates"],
    queryFn: () => getTemplates(),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      successAlert("Template deleted successfully.");
    },
    onError: () => errorAlert("Failed to delete template."),
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      successAlert("Template duplicated successfully.");
    },
    onError: () => errorAlert("Failed to duplicate template."),
  });

  const seedMutation = useMutation({
    mutationFn: seedTemplates,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      successAlert(`Created ${res.created.length} default template(s).`);
    },
    onError: () => errorAlert("Failed to seed default templates."),
  });

  const handlePreview = async (template: DocumentTemplate) => {
    try {
      const url = await fetchTemplatePreviewPdf(template._id);
      setPreview({ id: template._id, name: template.name, url });
    } catch {
      errorAlert("Could not generate a preview for this template.");
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      const docLabel = DOCUMENT_NAMES[t.documentType] || t.documentType;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q) ||
        t.documentType.toLowerCase().includes(q) ||
        docLabel.toLowerCase().includes(q)
      );
    });
  }, [templates, search, statusFilter]);

  const handleDelete = (template: DocumentTemplate) => {
    confirmAlert(`Permanently delete "${template.name}"? This cannot be undone.`, "Delete", () => {
      deleteMutation.mutate(template._id);
    });
  };

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Each template sets the fee, status and PDF layout for one barangay document type. Price changes are sent for Super Admin approval.
      </p>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type, or description..."
            className="pl-9"
            aria-label="Search document templates"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} template(s)</span>
        <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <Sparkles className="mr-1 size-4" />
            {seedMutation.isPending ? "Seeding..." : "Seed Defaults"}
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" asChild>
            <Link href={createHref}>
              <Plus className="mr-1 size-4" />
              Create Template
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <RefreshCcw className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="mb-3 text-muted-foreground">Could not load the document templates.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <RefreshCcw className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            {templates.length === 0 ? 'No templates yet. Click "Seed Defaults" or create one.' : "No templates match your search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const dims = PAGE_DIMS[template.page.size] || PAGE_DIMS.A4;
            const priceStatus = template.priceApprovalStatus;
            return (
              <div
                key={template._id}
                className="group flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold leading-snug text-slate-900" title={template.name}>
                      {template.name}
                    </h3>
                    <p className="mt-1 truncate text-xs font-medium uppercase tracking-wider text-slate-500" title={DOCUMENT_NAMES[template.documentType] || template.documentType}>
                      {DOCUMENT_NAMES[template.documentType] || template.documentType}
                      <span className="mx-2 text-slate-300">|</span>v{template.version}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${
                      STATUS_STYLES[template.status] || STATUS_STYLES.inactive
                    }`}
                  >
                    {template.status}
                  </span>
                </div>

                <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-slate-600">
                  {template.description || "No description provided for this document template."}
                </p>

                <div className="mt-auto border-t border-slate-100 pt-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded border bg-slate-50 px-2 py-0.5 font-semibold text-slate-900" title="Current active price">
                      {formatPeso(template.fee, template.currency)}
                    </span>
                    {priceStatus === "pending" ? (
                      <>
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700" title="Proposed price awaiting approval">
                          Proposed {formatPeso(template.pendingFee, template.currency)}
                        </span>
                        <PriceStatusBadge status="pending" />
                      </>
                    ) : priceStatus === "approved" || priceStatus === "rejected" ? (
                      <PriceStatusBadge status={priceStatus} />
                    ) : null}
                  </div>
                  <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      {PAGE_SIZES[template.page.size] || template.page.size}
                      <span className="mx-1.5 opacity-50">·</span>
                      {(template.page.orientation || "portrait") === "landscape" ? `${dims.h}×${dims.w}` : `${dims.w}×${dims.h}`}
                      pt
                    </span>
                    <span>{template.contentFormat === "tiptap" ? "Rich document" : `${template.elements.length} element(s)`}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={editHref(template._id)}>
                        <Edit className="mr-1.5 size-3.5" /> Edit
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(template)} title="Preview" aria-label={`Preview ${template.name}`}>
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateMutation.mutate(template._id)}
                      disabled={duplicateMutation.isPending}
                      title="Duplicate"
                      aria-label={`Duplicate ${template.name}`}
                    >
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDelete(template)}
                      title="Delete"
                      aria-label={`Delete ${template.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="flex h-[80vh] flex-col sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Preview — {preview?.name}</DialogTitle>
            <DialogDescription>Sample data preview rendered by the template engine.</DialogDescription>
          </DialogHeader>
          {preview ? <iframe src={preview.url} className="w-full flex-1 rounded-lg border bg-white" title="Template preview" /> : null}
          <DialogFooter>
            <Button variant="outline" onClick={closePreview}>
              <X className="mr-1 size-4" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
