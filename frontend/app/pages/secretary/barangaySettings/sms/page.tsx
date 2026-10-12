"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  ArrowLeft,
  Loader2,
  Save,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { useSuperAdminGuard } from "@/app/hooks/useRoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { settingsApi } from "@/app/utils/barangayApi";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  smsSettings,
  barangaySettings,
  EMPTY_SMS_SETTINGS,
  SMS_TEMPLATE_FIELDS,
  SMS_VARIABLES,
  DEFAULT_SMS_TEMPLATES,
} from "@/app/types/barangaySettings.type";

const SMS_SEGMENT_LENGTH = 160;

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useSuperAdminGuard();
  const store = useBarangaySettingsStore();
  const [form, setForm] = useState<smsSettings>({
    ...EMPTY_SMS_SETTINGS,
    templates: { ...DEFAULT_SMS_TEMPLATES },
  });
  const [saving, setSaving] = useState(false);

  const settings = store.settings;
  useEffect(() => {
    useBarangaySettingsStore.getState().load();
  }, []);

  const [resolvedSettings, setResolvedSettings] = useState<
    barangaySettings | null | undefined
  >(undefined);
  if (settings !== resolvedSettings) {
    setResolvedSettings(settings);
    if (settings) {
      setForm({
        ...EMPTY_SMS_SETTINGS,
        ...settings.sms,
        templates: { ...DEFAULT_SMS_TEMPLATES, ...(settings.sms?.templates ?? {}) },
        templateEnabled: { ...(settings.sms?.templateEnabled ?? {}) },
      });
    }
  }

  const set = <K extends keyof smsSettings>(key: K, value: smsSettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setTemplate = (key: string, value: string) =>
    setForm((f) => ({ ...f, templates: { ...f.templates, [key]: value } }));

  const appendVariable = (key: string, token: string) =>
    setTemplate(key, (form.templates[key] ?? "") + token);

  const resetTemplate = (key: string) =>
    setTemplate(key, DEFAULT_SMS_TEMPLATES[key] ?? "");

  const setTemplateEnabled = (key: string, value: boolean) =>
    setForm((f) => ({
      ...f,
      templateEnabled: { ...f.templateEnabled, [key]: value },
    }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await settingsApi.update({ sms: form });
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("SMS settings saved.");
    } catch (e) {
      const data = (e as { response?: { data?: unknown } } | null)?.response?.data;
      const message =
        typeof data === "string" && data.trim()
          ? data
          : (data as { message?: string } | undefined)?.message;
      errorAlert(message || "Failed to save SMS settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggles: { key: "enabled" | "notifyOnRequest" | "notifyOnStatus" | "notifyOnPayment"; label: string; desc: string }[] = [
    { key: "enabled", label: "Enable SMS notifications", desc: "Master switch for sending SMS via iProg SMS." },
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
          Configure which events trigger SMS messages and edit the message
          text. The API key is stored securely on the server.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-800">
          <ShieldCheck className="size-4 text-sky-600" /> Sender Name
        </h2>
        <div className="grid max-w-sm gap-2">
          <Label>Sender Name</Label>
          <Input value={form.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="e.g. BRGY RABON" />
          <p className="text-xs text-muted-foreground">
            Shown as the sender on outgoing SMS. Falls back to the server default
            if left blank. Messages are sent via iProg SMS.
          </p>
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
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-800">
          <MessageSquare className="size-4 text-sky-600" /> Message Templates
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Customize the message sent for each event. Click a variable to insert
          it into the message; it is replaced with the real value when sent.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {SMS_VARIABLES.map((v) => (
            <span
              key={v.token}
              title={v.description}
              className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-mono text-xs text-sky-700"
            >
              {v.token}
            </span>
          ))}
        </div>

        <div className="space-y-5">
          {SMS_TEMPLATE_FIELDS.map((t) => {
            const value = form.templates[t.key] ?? "";
            const active = form.templateEnabled[t.key] !== false;
            const segments = Math.max(1, Math.ceil(value.length / SMS_SEGMENT_LENGTH));
            return (
              <div key={t.key} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Label>{t.label}</Label>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-slate-500"
                      onClick={() => resetTemplate(t.key)}
                    >
                      <RotateCcw className="size-3.5" /> Reset
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {active ? "On" : "Off"}
                    </span>
                    <Switch
                      checked={active}
                      onCheckedChange={(v) => setTemplateEnabled(t.key, v)}
                    />
                  </div>
                </div>
                <Textarea
                  value={value}
                  rows={3}
                  disabled={!active}
                  onChange={(e) => setTemplate(t.key, e.target.value)}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.variables.map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={!active}
                      onClick={() => appendVariable(t.key, `{{${name}}}`)}
                      className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {`{{${name}}}`}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {value.length} chars · {segments} SMS
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save SMS Settings
        </Button>
      </div>
    </div>
  );
}
