"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Loader2,
  ArrowLeft,
  Settings2,
  Type,
  Layout,
  GripVertical
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import useBarangaySettingsStore from "@/app/store/useBarangaySettingsStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { settingsApi } from "@/app/utils/barangayApi";
import { successAlert, errorAlert } from "@/app/utils/alert";
import {
  documentSettings,
  EMPTY_DOCUMENT_SETTINGS,
  officialOverlaySlot,
  TemplateConfig,
} from "@/app/types/barangaySettings.type";
import { documentTypes } from "@/app/utils/documents";
import { OFFICIAL_POSITIONS } from "@/app/types/official.type";
import { isValidImageUrl } from "@/app/utils/documentImageUrl";

const ImagePreview = ({ url, label }: { url: string | null | undefined; label: string }) => {
  if (!url || !isValidImageUrl(url)) return null;
  return (
    <div className="mt-2 w-20 h-20 border rounded-md overflow-hidden bg-slate-100 flex items-center justify-center">
      <img src={url} alt={label} className="w-full h-full object-cover" />
    </div>
  );
};

export default function Page() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const store = useBarangaySettingsStore();
  const [docs, setDocs] = useState<documentSettings>({ ...EMPTY_DOCUMENT_SETTINGS });
  const [saving, setSaving] = useState(false);
  const [docKey, setDocKey] = useState(documentTypes[0]?.document ?? "");

  // New: Template Config helper
  const templateConfig: TemplateConfig = docs.templates[docKey] ?? {
    backgroundUrl: "",
    marginLeft: 60,
    marginRight: 60,
    marginTop: 60,
    marginBottom: 60,
    overlays: [],
  };

  const saveSettings = async () => {
    const invalidUrls: string[] = [];
    for (const [key, label] of [
      ["logoUrl", "Logo URL"],
      ["sealUrl", "Seal URL"],
    ] as const) {
      if (!isValidImageUrl(docs[key])) invalidUrls.push(label);
    }
    if (!isValidImageUrl(templateConfig.backgroundUrl))
      invalidUrls.push("Background Image URL");

    if (invalidUrls.length > 0) {
      errorAlert(`${invalidUrls.join(", ")} must be empty or a valid image URL.`);
      return;
    }

    setSaving(true);
    try {
      const updated = await settingsApi.update({ documents: docs });
      store.setSettings(updated);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      successAlert("Document settings updated.");
    } catch (e) {
      errorAlert(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to update document settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const updateOverlays = (slots: officialOverlaySlot[]) => { const nextSlots = [...slots]; setDocs((d) => ({ ...d, templates: { ...d.templates, [docKey]: { ...templateConfig, overlays: nextSlots }, }, })); };

  const set = (key: keyof documentSettings, value: string) =>
    setDocs((d) => ({ ...d, [key]: value }));

  const updateTemplate = (key: keyof TemplateConfig, value: string) =>
    setDocs((d) => ({
      ...d,
      templates: { ...d.templates, [docKey]: { ...templateConfig, [key]: value } },
    }));

  const currentSlots = templateConfig.overlays;
  const positions: string[] = [...OFFICIAL_POSITIONS];

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 text-slate-500" onClick={() => router.push("/pages/secretary/barangaySettings")}>
          <ArrowLeft className="size-4" /> Back to Settings
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          <FileText className="mr-2 inline size-6 text-sky-600" />
          Certificate Templates
        </h1>
        <p className="text-sm text-slate-500">
          Calibrate the official name overlays and header/footer settings for each
          document template.
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-4">
        <AccordionItem value="doc-settings" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <AccordionTrigger className="hover:no-underline">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <FileText className="size-4 text-sky-600" /> Document Settings
            </h2>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Header Text</Label>
                <Textarea value={docs.headerText} onChange={(e) => set("headerText", e.target.value)} rows={2} />
              </div>
              <div className="grid gap-2">
                <Label>Footer Text</Label>
                <Textarea value={docs.footerText} onChange={(e) => set("footerText", e.target.value)} rows={2} />
              </div>
              <div className="grid gap-2">
                <Label>Logo URL</Label>
                <Input value={docs.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
                <ImagePreview url={docs.logoUrl} label="Logo" />
              </div>
              <div className="grid gap-2">
                <Label>Background Image URL</Label>
                <Input value={templateConfig.backgroundUrl} onChange={(e) => updateTemplate("backgroundUrl", e.target.value)} />
                <ImagePreview url={templateConfig.backgroundUrl} label="Background" />
              </div>
              <div className="grid gap-2">
                <Label>Watermark Text</Label>
                <Input value={docs.watermarkText} onChange={(e) => set("watermarkText", e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Seal URL</Label>
                <Input value={docs.sealUrl} onChange={(e) => set("sealUrl", e.target.value)} />
                <ImagePreview url={docs.sealUrl} label="Seal" />
              </div>
              <div className="grid gap-2">
                <Label>Certificate Number Format</Label>
                <Input
                  value={docs.certificateNumberFormat}
                  onChange={(e) => set("certificateNumberFormat", e.target.value)}
                  placeholder="e.g. BRGY-CERT-{year}-{seq}"
                />
              </div>
              <div className="grid gap-2">
                <Label>Signatory Title</Label>
                <Input value={docs.signatoryTitle} onChange={(e) => set("signatoryTitle", e.target.value)} />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Document Settings
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="template-overlays" className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <AccordionTrigger className="hover:no-underline">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
              <Layout className="size-4 text-sky-600" /> Overlay Slots
            </h2>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-2 sm:w-72">
              <Label>Select Document Template</Label>
              <select
                value={docKey}
                onChange={(e) => setDocKey(e.target.value)}
                className="h-9 rounded-md border bg-white px-3 text-sm"
              >
                {documentTypes.map((d) => (
                  <option key={d.document} value={d.document}>
                    {d.document}
                  </option>
                ))}
              </select>
            </div>

        <div className="mt-4 space-y-3">
          <DndContext collisionDetection={closestCenter} onDragEnd={(e) => { const { active, over } = e; if (active.id !== over?.id) { setDocs((d) => { const oldIndex = currentSlots.findIndex((_, idx) => idx.toString() === active.id); const newIndex = currentSlots.findIndex((_, idx) => idx.toString() === over?.id); const nextSlots = arrayMove(currentSlots, oldIndex, newIndex); return { ...d, templates: { ...d.templates, [docKey]: { ...templateConfig, overlays: nextSlots } }, }; }); } }}>
            <SortableContext
              items={currentSlots.map((_, idx) => idx.toString())}
              strategy={verticalListSortingStrategy}
            >
              {currentSlots.map((slot, idx) => (
                <SortableOverlayItem
                  key={idx}
                  id={idx.toString()}
                  slot={slot}
                  positions={positions}
                  onChange={(next) => {
                    const copy = currentSlots.slice();
                    copy[idx] = next;
                    updateOverlays(copy);
                  }}
                  onRemove={() => updateOverlays(currentSlots.filter((_, i) => i !== idx))}
                />
              ))}
            </SortableContext>
          </DndContext>
          {currentSlots.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No overlay slots configured for this document. Add one to make an
              official&apos;s name dynamic.
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              updateOverlays([
                ...currentSlots,
                {
                  position: "Punong Barangay",
                  enabled: true,
                  x: 0.25,
                  y: 0.86,
                  w: 0.5,
                  h: 0.03,
                  fontScale: 0.85,
                  align: "center",
                  font: "times-bold",
                  textColor: "#000000",
                },
              ])
            }
          >
            <Plus className="size-4" /> Add Slot
          </Button>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Overlays
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
</div>
  );
}

function OverlaySlotRow({
  slot,
  positions,
  onChange,
  onRemove,
}: {
  slot: officialOverlaySlot;
  positions: string[];
  onChange: (next: officialOverlaySlot) => void;
  onRemove: () => void;
}) {
  const set = (key: string, value: string | number | boolean) => onChange({ ...slot, [key]: value });
  const numInputs: { key: "x" | "y" | "w" | "h" | "fontScale"; label: string }[] = [
    { key: "x", label: "X" },
    { key: "y", label: "Y" },
    { key: "w", label: "W" },
    { key: "h", label: "H" },
    { key: "fontScale", label: "Scale" },
  ];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      {/* 1. Identity & Position */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Layout className="size-4 text-sky-600"/>
            Slot Identity
          </Label>
          <Button variant="ghost" size="sm" onClick={onRemove} className="h-8 text-rose-500 hover:text-rose-600">
            <Trash2 className="size-4 mr-2" /> Remove
          </Button>
        </div>
        <select
          value={positions.includes(slot.position) ? slot.position : "__custom"}
          onChange={(e) => {
            if (e.target.value === "__custom") return;
            set("position", e.target.value);
          }}
          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="__custom" disabled={positions.includes(slot.position)}>
            {positions.includes(slot.position) ? slot.position : "Custom: " + slot.position}
          </option>
          {positions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {!positions.includes(slot.position) && (
          <Input
            className="h-10"
            value={slot.position}
            onChange={(e) => set("position", e.target.value)}
            placeholder="Custom Position Name"
          />
        )}
      </div>

      {/* 2. Dimensions & Alignment */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Settings2 className="size-4 text-sky-600"/>
          Dimensions & Alignment
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {numInputs.map((n) => (
            <div key={n.key} className="space-y-1">
              <Label className="text-[11px] uppercase text-slate-500 font-semibold">{n.label}</Label>
              <Input
                type="number"
                step="0.01"
                className="h-9"
                value={slot[n.key]}
                onChange={(e) => set(n.key, Number(e.target.value) || 0)}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-[11px] uppercase text-slate-500 font-semibold">Align</Label>
            <select
              value={slot.align}
              onChange={(e) => set("align", e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 px-2 text-sm"
            >
              <option value="center">center</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Styling */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={slot.enabled} onChange={(e) => set("enabled", e.target.checked)} className="size-4 rounded border-slate-300 accent-sky-600"/>
          Enabled
        </label>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Type className="size-4 text-slate-400" />
            <select
              value={slot.font}
              onChange={(e) => set("font", e.target.value)}
              className="h-9 rounded-md border border-slate-300 px-2 text-sm"
            >
              <option value="times-bold">Times Bold</option>
              <option value="helvetica-bold">Helvetica Bold</option>
              <option value="helvetica">Helvetica</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={slot.textColor || "#000000"}
              onChange={(e) => set("textColor", e.target.value)}
              className="size-9 p-1 rounded border border-slate-300 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
}












interface SortableOverlayItemProps {
  slot: officialOverlaySlot;
  positions: string[];
  onChange: (next: officialOverlaySlot) => void;
  onRemove: () => void;
  id: string;
}

function SortableOverlayItem({
  slot,
  positions,
  onChange,
  onRemove,
  id
}: SortableOverlayItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start">
      <div {...attributes} {...listeners} className="mt-5 cursor-grab text-slate-400">
        <GripVertical className="size-5" />
      </div>
      <div className="flex-1">
        <OverlaySlotRow
          slot={slot}
          positions={positions}
          onChange={onChange}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}





































































































