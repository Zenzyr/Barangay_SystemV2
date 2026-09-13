"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  OFFICIAL_POSITIONS,
  SINGLE_HOLDER_POSITIONS,
} from "@/app/types/official.type";

export interface OfficialFormValues {
  fullName: string;
  position: string;
  status: "active" | "inactive";
  precedence: number;
  termStart: string;
  termEnd: string;
  termLabel: string;
  signatureImage: string;
  photo: string;
  contact: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog is editing this official. */
  initial?: Partial<OfficialFormValues> | null;
  title?: string;
  onSubmit: (values: OfficialFormValues) => void;
  submitLabel?: string;
  /** Upload one image asset to the official record, returns the new URL. */
  onUpload?: (kind: "photo" | "signature", file: File) => Promise<string>;
  /** Tracks whether an asset upload is in flight. */
  uploading?: boolean;
}

const EMPTY: OfficialFormValues = {
  fullName: "",
  position: "",
  status: "inactive",
  precedence: 0,
  termStart: "",
  termEnd: "",
  termLabel: "",
  signatureImage: "",
  photo: "",
  contact: "",
  notes: "",
};

export function OfficialFormDialog({
  open,
  onOpenChange,
  initial,
  title = "Add Official",
  onSubmit,
  submitLabel = "Save Official",
  onUpload,
  uploading,
}: Props) {
  const [form, setForm] = useState<OfficialFormValues>({
    ...EMPTY,
    ...(initial ?? {}),
  });
  const [error, setError] = useState("");

  const set = (key: keyof OfficialFormValues, value: string | number | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isSingleHolder =
    SINGLE_HOLDER_POSITIONS.includes(form.position as (typeof SINGLE_HOLDER_POSITIONS)[number]) || form.position === "";

  const isOtherPosition = form.position === "Other";

  const handleFile = async (kind: "photo" | "signature", file: File | null) => {
    if (!file || !onUpload) return;
    try {
      const url = await onUpload(kind, file);
      set(kind === "photo" ? "photo" : "signatureImage", url);
    } catch (e) {
      setError(`Failed to upload ${kind}.`);
    }
  };

  const handleSubmit = () => {
    setError("");
    if (!form.fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!form.position) {
      setError("Position is required.");
      return;
    }
    if (form.termStart && form.termEnd && new Date(form.termEnd) < new Date(form.termStart)) {
      setError("Term end date cannot be earlier than the term start date.");
      return;
    }
    onSubmit({ ...form, fullName: form.fullName.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isSingleHolder
              ? "Saving as Active will automatically move the previous holder to historical records."
              : "This position allows multiple holders."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-2">
            <Label>Full Name *</Label>
            <Input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="e.g. Hon. Juan Dela Cruz"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Position *</Label>
              <Select value={form.position} onValueChange={(v) => set("position", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  {OFFICIAL_POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isOtherPosition && (
                <Input
                  value={form.position === "Other" ? "" : form.position}
                  placeholder="Enter custom position"
                  onChange={(e) => set("position", e.target.value)}
                />
              )}
            </div>
            <div className="grid gap-2">
              <Label>Precedence</Label>
              <Input
                type="number"
                value={form.precedence}
                onChange={(e) => set("precedence", Number(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Contact Number</Label>
              <Input
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                placeholder="09xx xxx xxxx"
              />
            </div>
            <div className="grid gap-2" />

            <div className="grid gap-2">
              <Label>Signature</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={!onUpload || uploading}
                onChange={(e) => handleFile("signature", e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Photo</Label>
              <Input
                type="file"
                accept="image/*"
                disabled={!onUpload || uploading}
                onChange={(e) => handleFile("photo", e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">
                {form.status === "active" ? "Currently serving" : "Historical / previous record"}
              </p>
            </div>
            <Switch
              checked={form.status === "active"}
              onCheckedChange={(v) => set("status", v ? "active" : "inactive")}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Term Start</Label>
              <Input type="date" value={form.termStart} onChange={(e) => set("termStart", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Term End</Label>
              <Input type="date" value={form.termEnd} onChange={(e) => set("termEnd", e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Term Label</Label>
              <Input value={form.termLabel} onChange={(e) => set("termLabel", e.target.value)} placeholder="2026–2029" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Signature Image URL</Label>
              <Input value={form.signatureImage} onChange={(e) => set("signatureImage", e.target.value)} placeholder="https://..." />
            </div>
            <div className="grid gap-2">
              <Label>Photo URL</Label>
              <Input value={form.photo} onChange={(e) => set("photo", e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{submitLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}