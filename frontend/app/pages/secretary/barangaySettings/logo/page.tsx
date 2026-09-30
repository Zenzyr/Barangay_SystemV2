"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Image as ImageIcon,
  ArrowLeft,
  Loader2,
  Save,
  Trash2,
  Building2,
} from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  const [saving, setSaving] = useState(false);

  const settings = store.settings;
  const [resolvedSettings, setResolvedSettings] = useState(settings);
  if (settings !== resolvedSettings) {
    setResolvedSettings(settings);
    if (settings) setForm({ ...EMPTY_BARANGAY_INFO, ...settings.barangay });
  }

  const set = (key: keyof barangayInfo, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const assetMut = useMutation({
    mutationFn: ({ kind, file }: { kind: "logo" | "seal"; file: File | null }) =>
      settingsApi.uploadAsset(kind, file),
    onSuccess: (updated) => {
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("Branding asset updated.");
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } } | null;
      errorAlert(err?.response?.data?.message || "Failed to upload asset.");
    },
  });

  const saveInfo = async () => {
    if (!form.name.trim()) {
      errorAlert("Barangay name is required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await settingsApi.update({ barangay: form });
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("Barangay information updated.");
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } } | null;
      errorAlert(err?.response?.data?.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof barangayInfo; label: string; full?: boolean }[] = [
    { key: "name", label: "Barangay Name" },
    { key: "municipality", label: "Municipality / City" },
    { key: "province", label: "Province" },
    { key: "region", label: "Region" },
    { key: "address", label: "Address", full: true },
    { key: "contactNumber", label: "Contact Number" },
    { key: "email", label: "Email" },
  ];

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <Building2 className="mr-2 inline size-6 text-sky-600" />
          Logo & General Info
        </h1>
        <p className="text-sm text-slate-500">
          Upload the barangay logo, and update the barangay details used across
          documents and the app. The seal and signature are applied manually.
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

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <ImageIcon className="size-4 text-sky-600" /> Barangay Information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key} className={"grid gap-2 " + (f.full ? "sm:col-span-2" : "")}>
              <Label>{f.label}</Label>
              <Input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
            </div>
          ))}
          <div className="grid gap-2 sm:col-span-2">
            <Label>Header Text</Label>
            <Textarea value={form.headerText} onChange={(e) => set("headerText", e.target.value)} rows={2} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Footer Text</Label>
            <Textarea value={form.footerText} onChange={(e) => set("footerText", e.target.value)} rows={2} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveInfo} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Changes
          </Button>
        </div>
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