"use client";

import { use } from "react";
import { TemplateEditor } from "@/components/documentTemplate/visualEditor";

export default function EditDocumentTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TemplateEditor isCreate={false} templateId={id} onSaved={() => undefined} />;
}