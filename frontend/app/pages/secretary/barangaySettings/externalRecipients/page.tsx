"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { settingsApi } from "@/app/utils/barangayApi";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  externalRecipient,
  EMPTY_EXTERNAL_RECIPIENTS,
} from "@/app/types/barangaySettings.type";

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useSuperAdminGuard();
  const store = useBarangaySettingsStore();
  const [recipients, setRecipients] = useState<externalRecipient[]>(
    EMPTY_EXTERNAL_RECIPIENTS.map((r) => ({ ...r }))
  );
  const [saving, setSaving] = useState(false);

  const settings = store.settings;
  const [resolvedSettings, setResolvedSettings] = useState(settings);
  if (settings !== resolvedSettings) {
    setResolvedSettings(settings);
    if (settings) {
      const current =
        settings.externalRecipients && settings.externalRecipients.length > 0
          ? settings.externalRecipients
          : EMPTY_EXTERNAL_RECIPIENTS;
      setRecipients(current.map((r) => ({ ...r })));
    }
  }

  const update = (idx: number, key: keyof externalRecipient, value: string) =>
    setRecipients((list) =>
      list.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );

  const addRow = () =>
    setRecipients((list) => [
      ...list,
      { label: "", name: "", position: "" },
    ]);

  const removeRow = (idx: number) =>
    setRecipients((list) => list.filter((_, i) => i !== idx));

  const save = async () => {
    const clean = recipients
      .map((r) => ({
        label: r.label.trim(),
        name: r.name.trim(),
        position: r.position.trim(),
      }))
      .filter(
        (r) => r.name && (r.label || r.position)
      );
    if (clean.length === 0) {
      errorAlert("At least one recipient with a name is required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await settingsApi.update({ externalRecipients: clean });
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("External recipients updated.");
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } } | null;
      errorAlert(err?.response?.data?.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-slate-500"
          onClick={() =>
            router.push("/pages/secretary/barangaySettings")
          }
        >
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <Building2 className="mr-2 inline size-6 text-sky-600" />
          External Recipients
        </h1>
        <p className="text-sm text-slate-500">
          Names of offices or persons outside the barangay that documents are
          addressed to (e.g. the Municipal Mayor for endorsement letters).
          These are used automatically in generated documents.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-4">
          {recipients.map((r, idx) => (
            <div
              key={idx}
              className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-[1fr_1.5fr_1.5fr_auto] sm:items-end"
            >
              <div className="grid gap-1.5">
                <Label>Label</Label>
                <Input
                  placeholder="Mayor"
                  value={r.label}
                  onChange={(e) => update(idx, "label", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input
                  placeholder="Full name of official"
                  value={r.name}
                  onChange={(e) => update(idx, "name", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Position</Label>
                <Input
                  placeholder="Mayor"
                  value={r.position}
                  onChange={(e) => update(idx, "position", e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => removeRow(idx)}
                disabled={recipients.length === 1}
                aria-label="Remove recipient"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-4" /> Add Recipient
          </Button>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}