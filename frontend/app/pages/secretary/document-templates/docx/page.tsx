"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download, Edit, Eye, FileText, Loader2, RefreshCcw, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { successAlert, errorAlert, confirmAlert } from "@/app/utils/alert";
import useUserStore from "@/app/store/useUserStore";
import {
  deleteDocxTemplate,
  downloadDocxTemplate,
  duplicateDocxTemplate,
  getApiErrorMessage,
  getDocxTemplates,
  seedDocxTemplates,
} from "@/app/utils/docxTemplateService";
import type { DocxTemplateSummary } from "@/app/types/docxTemplate.type";

const EDITOR_BASE = "/pages/secretary/document-templates/docx";

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

const authorName = (author: DocxTemplateSummary["createdBy"]) =>
  author && typeof author === "object" ? author.name : "—";

export default function Page() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: templates = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["docx-templates"],
    queryFn: getDocxTemplates,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["docx-templates"] });

  const seedMutation = useMutation({
    mutationFn: seedDocxTemplates,
    onSuccess: (res) => {
      refresh();
      successAlert(
        res.created.length ? `Imported ${res.created.length} default template(s).` : "All default templates are already imported."
      );
    },
    onError: async (error) => errorAlert(await getApiErrorMessage(error, "Failed to import the default templates.")),
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateDocxTemplate,
    onSuccess: () => {
      refresh();
      successAlert("Template duplicated.");
    },
    onError: async (error) => errorAlert(await getApiErrorMessage(error, "Failed to duplicate the template.")),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocxTemplate,
    onSuccess: () => {
      refresh();
      successAlert("Template deleted.");
    },
    onError: async (error) => errorAlert(await getApiErrorMessage(error, "Failed to delete the template.")),
  });

  const handleDownload = async (template: DocxTemplateSummary) => {
    setBusyId(template._id);
    try {
      const warnings = await downloadDocxTemplate(template._id, template.slug);
      successAlert("Downloaded as .docx.");
      if (warnings.length) errorAlert(`Some elements were left out of the .docx: ${warnings.join("; ")}`);
    } catch (error) {
      errorAlert(await getApiErrorMessage(error, "Failed to export the template."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (template: DocxTemplateSummary) => {
    confirmAlert(`Permanently delete "${template.name}"? This cannot be undone.`, "Delete", () => deleteMutation.mutate(template._id));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => t.name.toLowerCase().includes(q) || (t.originalFilename || "").toLowerCase().includes(q));
  }, [templates, search]);

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link href="/pages/secretary/document-templates">
              <ArrowLeft className="mr-1 size-4" /> PDF Templates
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">DOCX Templates</h1>
          <p className="text-sm text-muted-foreground">
            Word-style document templates edited in the browser. Use variables such as {"{{resident_name}}"} for data BIMS fills in.
          </p>
        </div>
        {isSuperAdmin ? (
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            <Sparkles className="mr-1 size-4" />
            {seedMutation.isPending ? "Importing..." : "Import Defaults"}
          </Button>
        ) : null}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" aria-label="Search templates" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} template(s)</span>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <RefreshCcw className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="mb-3 text-muted-foreground">Could not load the templates.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-white py-16 text-center">
          <FileText className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-muted-foreground">
            {templates.length === 0
              ? isSuperAdmin
                ? 'No templates yet. Click "Import Defaults" to add the six barangay templates.'
                : "No templates yet. Ask a Super Admin to import the default templates."
              : "No templates match your search."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((template) => {
            const busy = busyId === template._id;
            return (
              <div key={template._id} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold leading-snug text-slate-900" title={template.name}>
                    {template.name}
                  </h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">
                    {template.page.size}
                    <span className="mx-2 text-slate-300">|</span>v{template.version}
                    <span className="mx-2 text-slate-300">|</span>
                    {template.variables.length} variable{template.variables.length === 1 ? "" : "s"}
                  </p>
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-slate-600">
                  <dt className="text-slate-400">Last updated</dt>
                  <dd>{formatDate(template.updatedAt)}</dd>
                  <dt className="text-slate-400">Updated by</dt>
                  <dd>{authorName(template.updatedBy)}</dd>
                  <dt className="text-slate-400">Created by</dt>
                  <dd>{authorName(template.createdBy)}</dd>
                  {template.originalFilename ? (
                    <>
                      <dt className="text-slate-400">Based on</dt>
                      <dd className="truncate" title={template.originalFilename}>
                        {template.originalFilename}
                      </dd>
                    </>
                  ) : null}
                </dl>

                <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-4">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`${EDITOR_BASE}/${template._id}/edit`}>
                      <Edit className="mr-1.5 size-3.5" /> Edit
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm" title="Preview" aria-label={`Preview ${template.name}`}>
                    <Link href={`${EDITOR_BASE}/${template._id}/edit?preview=1`}>
                      <Eye className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Duplicate"
                    aria-label={`Duplicate ${template.name}`}
                    onClick={() => duplicateMutation.mutate(template._id)}
                    disabled={duplicateMutation.isPending}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Download .docx" aria-label={`Download ${template.name} as .docx`} onClick={() => handleDownload(template)} disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Delete"
                    aria-label={`Delete ${template.name}`}
                    onClick={() => handleDelete(template)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
