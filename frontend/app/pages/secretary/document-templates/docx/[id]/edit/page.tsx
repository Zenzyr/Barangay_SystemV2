"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage, getDocxTemplate, getTemplateVariables } from "@/app/utils/docxTemplateService";
import { TemplateEditor } from "../../components/templateEditor";

function EditorLoader() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [nonce, setNonce] = useState(0);

  const template = useQuery({
    queryKey: ["docx-template", id],
    queryFn: () => getDocxTemplate(id),
    // The editor owns the working copy once loaded: never refetch under it, and
    // never serve a cached copy on the next visit (it could be a stale version).
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const variables = useQuery({
    queryKey: ["docx-template-variables"],
    queryFn: getTemplateVariables,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (template.isLoading || variables.isLoading) {
    return (
      <div className="flex h-full flex-col gap-3 p-4" aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="mx-auto h-[600px] w-full max-w-3xl" />
      </div>
    );
  }

  if (template.isError || variables.isError || !template.data) {
    const error = template.error ?? variables.error;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
        <AlertTriangle className="size-8 text-amber-500" />
        <h1 className="text-lg font-semibold">Could not open this template</h1>
        <ErrorDetail error={error} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              template.refetch();
              variables.refetch();
            }}
          >
            Try again
          </Button>
          <Button asChild>
            <Link href="/pages/secretary/document-templates/docx">
              <ArrowLeft className="mr-1 size-4" /> Back to templates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <TemplateEditor
      // Remount only on an explicit reload (after a save conflict).
      key={`${template.data._id}:${nonce}`}
      template={template.data}
      variables={variables.data ?? []}
      startInPreview={search.get("preview") === "1"}
      onReload={async () => {
        await template.refetch();
        setNonce((n) => n + 1);
      }}
    />
  );
}

function ErrorDetail({ error }: { error: unknown }) {
  const { data } = useQuery({
    queryKey: ["docx-template-error", String(error)],
    queryFn: () => getApiErrorMessage(error, "The template could not be loaded."),
    staleTime: Infinity,
  });
  return <p className="text-sm text-slate-600">{data ?? "The template could not be loaded."}</p>;
}

export default function Page() {
  return (
    // Fills the viewport below the mobile header so the ribbon stays put while the page scrolls inside.
    <div className="h-[calc(100dvh-80px)] lg:h-dvh">
      <Suspense fallback={null}>
        <EditorLoader />
      </Suspense>
    </div>
  );
}
