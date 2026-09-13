"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTemplate } from "@/app/utils/templateService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CreateTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState("");

  const handleSave = async () => {
    await createTemplate({ name, documentType, layoutConfig: { blocks: [] } });
    router.push("/pages/admin/certificate-templates");
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Template</h1>
      <div className="space-y-4 max-w-lg">
        <div>
          <Label>Template Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>Document Type</Label>
          <Input value={documentType} onChange={(e) => setDocumentType(e.target.value)} />
        </div>
        <Button onClick={handleSave}>Save Template</Button>
      </div>
    </div>
  );
}
