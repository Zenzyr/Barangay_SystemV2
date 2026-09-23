"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  ArrowLeft,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { settingsApi } from "@/app/utils/barangayApi";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  smsSettings,
  EMPTY_SMS_SETTINGS,
} from "@/app/types/barangaySettings.type";

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useSuperAdminGuard();
  const store = useBarangaySettingsStore();
  const [form, setForm] = useState<smsSettings>({ ...EMPTY_SMS_SETTINGS });
  const [saving, setSaving] = useState(false);

  const settings = store.settings;
  const [resolvedSettings, setResolvedSettings] = useState(settings);
  if (settings !== resolvedSettings) {
    setResolvedSettings(settings);
    if (settings) setForm({ ...EMPTY_SMS_SETTINGS, ...settings.sms });
  }

  const set = <K extends keyof smsSettings>(key: K, value: smsSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.update({ sms: form });
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("SMS settings saved.");
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } } | null;
      errorAlert(err?.response?.data?.message || "Failed to save SMS settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggles: { key: "enabled" | "notifyOnRequest" | "notifyOnStatus" | "notifyOnPayment"; label: string; desc: string }[] = [
    { key: "enabled", label: "Enable SMS notifications", desc: "Master switch for sending SMS via Semaphore." },
    { key: "notifyOnRequest", label: "New document request", desc: "Notify the resident when a request is submitted." },
    { key: "notifyOnStatus", label: "Status updates", desc: "Notify the resident when the request status changes." },
    { key: "notifyOnPayment", label: "Payment confirmations", desc: "Notify the resident when a payment is recorded." },
  ];

  if (!isSuperAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <MessageSquare className="mr-2 inline size-6 text-sky-600" />
          SMS Notifications
        </h1>
        <p className="text-sm text-slate-500">
          Configure which events trigger SMS messages. The API key is stored securely on the server.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <ShieldCheck className="size-4 text-sky-600" /> Provider & Sender
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Provider</Label>
            <Input value={form.provider} onChange={(e) => set("provider", e.target.value)} placeholder="Semaphore" />
          </div>
          <div className="grid gap-2">
            <Label>Sender Name</Label>
            <Input value={form.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="e.g. BRGY RABON" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-800">
          <MessageSquare className="size-4 text-sky-600" /> Notification Events
        </h2>
        <div className="space-y-3">
          {toggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>{t.label}</Label>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <Switch checked={form[t.key]} onCheckedChange={(v) => set(t.key, v as smsSettings[typeof t.key])} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save SMS Settings
          </Button>
        </div>
      </div>
    </div>
  );
}