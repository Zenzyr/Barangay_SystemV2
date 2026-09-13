"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplates, deleteTemplate } from "@/app/utils/templateService";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { successAlert, errorAlert } from "@/app/utils/alert";

interface CertificateTemplate {
  _id: string;
  name: string;
  documentType: string;
}

export default function CertificateTemplatesPage() {
  const queryClient = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["certificate-templates"],
    queryFn: getTemplates,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["certificate-templates"] });
        successAlert("Template deleted successfully.");
    },
    onError: () => errorAlert("Failed to delete template.")
  });

  const handleDelete = (id: string) => {
    if(confirm("Are you sure you want to delete this template?")) {
        deleteMutation.mutate(id);
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Certificate Templates</h1>
        <Button asChild>
          <Link href="/pages/admin/certificate-templates/create">
            <Plus className="size-4 mr-2" />
            Create Template
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template: CertificateTemplate) => (
            <div key={template._id} className="p-4 border rounded-lg flex justify-between items-center bg-white">
              <div>
                <h3 className="font-semibold">{template.name}</h3>
                <p className="text-sm text-slate-500">{template.documentType}</p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/pages/admin/certificate-templates/edit/${template._id}`}>
                    <Edit className="size-4" />
                  </Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(template._id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
