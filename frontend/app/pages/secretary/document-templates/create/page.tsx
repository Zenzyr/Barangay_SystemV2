"use client";

import { TemplateEditor } from "@/components/documentTemplate/visualEditor";

export default function CreateDocumentTemplatePage() {
  return <TemplateEditor isCreate={true} onSaved={() => undefined} />;
}