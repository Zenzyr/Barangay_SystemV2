"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage, getDocxTemplate, getTemplateVariables } from "@/app/utils/docxTemplateService";
import { DocxTemplateEditor } from "./DocxTemplateEditor";

export function DocxTemplateEditorLoader({
  id,
  startInPreview,
  backHref,
}: {
  id: string;
  startInPreview?: boolean;
  backHref: string;
}) {
  const [nonce, setNonce] = useState(0);

  const template = useQuery({
    queryKey: ["docx-template", id],
    queryFn: () => getDocxTemplate(id),
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
            <Link href={backHref}>
              <ArrowLeft className="mr-1 size-4" /> Back to templates
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DocxTemplateEditor
      key={`${template.data._id}:${nonce}`}
      template={template.data}
      variables={variables.data ?? []}
      startInPreview={startInPreview}
      backHref={backHref}
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
