"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplates, deleteTemplate, duplicateTemplate, seedTemplates, fetchTemplatePreviewPdf, type DocumentTemplate } from "@/app/utils/documentTemplateService";
import { Plus, Search, Edit, Eye, Copy, Trash2, Sparkles, RefreshCcw, X, FileType } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import { DOCUMENT_NAMES } from "@/app/utils/documentRequestOptions";

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

const money = (n: number | undefined, currency?: string) =>
  n === undefined || n === null
    ? "—"
    : `${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || "PHP"}`;

export default function Page() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [preview, setPreview] = useState<{ id: string; name: string; url: string } | null>(null);

  const { data: templates = [], isLoading } = useQuery({
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (!q) return true;
      const docLabel = DOCUMENT_NAMES[t.documentType] || t.documentType;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
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

  const handleDuplicate = (template: DocumentTemplate) => {
    duplicateMutation.mutate(template._id);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Document Templates</h1>
          <p className="text-sm text-muted-foreground">
            Visual templates drive document layout, fees, and PDF generation for every barangay document.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/pages/secretary/document-templates/docx">
              <FileType className="size-4 mr-1" />
              DOCX Templates
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <Sparkles className="size-4 mr-1" />
            {seedMutation.isPending ? "Seeding..." : "Seed Defaults"}
          </Button>
          <Button asChild>
            <Link href="/pages/secretary/document-templates/create">
              <Plus className="size-4 mr-2" />
              Create Template
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, type, or description..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} template(s)</span>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border rounded-xl bg-white">
          <RefreshCcw className="size-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">
            {templates.length === 0 ? "No templates yet. Click \"Seed Defaults\" or create one." : "No templates match your search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const dims = PAGE_DIMS[template.page.size] || PAGE_DIMS.A4;
            return (
              <div
                key={template._id}
                className="group flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base leading-snug text-slate-900 truncate">
                      {template.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 uppercase tracking-wider font-medium">
                      {DOCUMENT_NAMES[template.documentType] || template.documentType}
                      <span className="mx-2 text-slate-300">|</span>
                      v{template.version}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${
                      STATUS_STYLES[template.status] || STATUS_STYLES.inactive
                    }`}
                  >
                    {template.status}
                  </span>
                </div>

                <p className="text-sm text-slate-600 line-clamp-3 flex-1 leading-relaxed">
                  {template.description || "No description provided for this document template."}
                </p>

                <div className="border-t border-slate-100 pt-4 mt-auto">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 mb-4">
                    <span className="font-semibold text-slate-900 bg-slate-50 px-2 py-0.5 rounded border">
                      {money(template.fee, template.currency)}
                    </span>
                    <span>
                      {PAGE_SIZES[template.page.size] || template.page.size}
                      <span className="mx-1.5 opacity-50">·</span>
                      {(template.page.orientation || "portrait") === "landscape"
                        ? `${dims.h}×${dims.w}`
                        : `${dims.w}×${dims.h}`}
                      pt
                    </span>
                    <span>
                      {template.contentFormat === "tiptap" ? "Rich document" : `${template.elements.length} element(s)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/pages/secretary/document-templates/edit/${template._id}`}>
                        <Edit className="size-3.5 mr-1.5" /> Edit
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(template)} title="Preview">
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDuplicate(template)} disabled={duplicateMutation.isPending} title="Duplicate">
                      <Copy className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-slate-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(template)} title="Delete">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="sm:max-w-[720px] h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview — {preview?.name}</DialogTitle>
            <DialogDescription>Sample data preview rendered by the template engine.</DialogDescription>
          </DialogHeader>
          {preview ? (
            <iframe src={preview.url} className="w-full flex-1 rounded-lg border bg-white" title="Template preview" />
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              <X className="size-4 mr-1" /> Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}