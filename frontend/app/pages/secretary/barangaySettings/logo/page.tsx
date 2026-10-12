"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
  Trash2,
  Building2,
} from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsApi } from "@/app/utils/barangayApi";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  barangayInfo,
  EMPTY_BARANGAY_INFO,
} from "@/app/types/barangaySettings.type";

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useSuperAdminGuard();
  const store = useBarangaySettingsStore();
  const [form, setForm] = useState<barangayInfo>({ ...EMPTY_BARANGAY_INFO });

  const settings = store.settings;
  const [resolvedSettings, setResolvedSettings] = useState(settings);
  if (settings !== resolvedSettings) {
    setResolvedSettings(settings);
    if (settings) setForm({ ...EMPTY_BARANGAY_INFO, ...settings.barangay });
  }

  // Surfaces the real server message whether the API returned JSON
  // ({ message }) or a plain-text body.
  const apiErrorMessage = (e: unknown, fallback: string) => {
    const data = (e as { response?: { data?: unknown } } | null)?.response?.data;
    if (typeof data === "string" && data.trim()) return data;
    const message = (data as { message?: string } | undefined)?.message;
    return message || (e as { message?: string } | null)?.message || fallback;
  };

  const assetMut = useMutation({
    mutationFn: ({ kind, file }: { kind: "logo" | "seal"; file: File | null }) =>
      settingsApi.uploadAsset(kind, file),
    onSuccess: (updated) => {
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("Branding asset updated.");
    },
    onError: (e: unknown) => {
      errorAlert(apiErrorMessage(e, "Failed to upload asset."));
    },
  });

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <Building2 className="mr-2 inline size-6 text-sky-600" />
          Barangay Logo
        </h1>
        <p className="text-sm text-slate-500">
          Upload the barangay logo used across documents and the app. The seal
          and signature are applied manually.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        <AssetCard
          title="Barangay Logo"
          url={form.logoUrl}
          uploading={assetMut.isPending}
          onUpload={(f) => assetMut.mutate({ kind: "logo", file: f })}
          onRemove={() => assetMut.mutate({ kind: "logo", file: null })}
        />
      </div>
    </div>
  );
}

function AssetCard({
  title,
  url,
  uploading,
  onUpload,
  onRemove,
}: {
  title: string;
  url: string;
  uploading: boolean;
  onUpload: (file: File | null) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [shownUrl, setShownUrl] = useState(url);
  if (url && url !== shownUrl) {
    setShownUrl(url);
    setPreview(null);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <ImageIcon className="size-4 text-sky-600" /> {title}
        </h2>
      </div>
      <div className="mb-3 flex h-32 items-center justify-center rounded-lg border bg-slate-50">
        {(preview || url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={preview ?? url}
            src={preview ?? url}
            alt={title}
            className="max-h-28 max-w-full object-contain"
          />
        ) : (
          <span className="text-sm text-slate-400">No image set</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label className="sr-only">Upload {title}</Label>
        <Input
          type="file"
          accept="image/*"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            if (file) setPreview(URL.createObjectURL(file));
            onUpload(file);
          }}
          className="flex-1"
        />
        {url && (
          <Button variant="outline" size="sm" onClick={onRemove} disabled={uploading}>
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
      </div>
      {uploading && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Uploading…
        </p>
      )}
    </div>
  );
}