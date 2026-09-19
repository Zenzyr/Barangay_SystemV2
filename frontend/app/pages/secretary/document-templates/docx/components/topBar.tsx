"use client";

import Link from "next/link";
import { ArrowLeft, Download, Eye, FileText, Loader2, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown } from "./ribbonPrimitives";

export type SaveState = "saved" | "saving" | "dirty" | "conflict";

const formatSavedAt = (date: Date) => {
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export function SaveStatus({ state, lastSaved, version }: { state: SaveState; lastSaved: Date | null; version: number }) {
  const label =
    state === "saving" ? "Saving…"
    : state === "conflict" ? "Changed by someone else"
    : state === "dirty" ? "Unsaved changes"
    : "Saved";
  const tone =
    state === "conflict" ? "text-red-600"
    : state === "dirty" ? "text-amber-600"
    : state === "saving" ? "text-slate-500"
    : "text-emerald-600";
  return (
    <p role="status" aria-live="polite" className="whitespace-nowrap text-xs text-slate-500">
      <span className={`font-medium ${tone}`}>{label}</span>
      {lastSaved && state !== "conflict" ? <span className="hidden sm:inline"> · Last saved {formatSavedAt(lastSaved)}</span> : null}
      <span className="hidden md:inline"> · v{version}</span>
    </p>
  );
}

export function TopBar({
  name,
  onNameChange,
  state,
  lastSaved,
  version,
  saving,
  onSave,
  onPreview,
  onPrint,
  onDownload,
  downloading,
  backHref,
}: {
  name: string;
  onNameChange: (name: string) => void;
  state: SaveState;
  lastSaved: Date | null;
  version: number;
  saving: boolean;
  onSave: () => void;
  onPreview: () => void;
  onPrint: () => void;
  onDownload: () => void;
  downloading: boolean;
  backHref: string;
}) {
  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100 disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-white px-3 py-2">
      <Button asChild variant="ghost" size="icon" aria-label="Back to templates" title="Back to templates">
        <Link href={backHref}>
          <ArrowLeft className="size-4" />
        </Link>
      </Button>

      <Dropdown label="File" width={240} trigger={<><FileText className="size-4" /><span className="text-sm font-medium">File</span></>}>
        {(close) => (
          <div className="flex flex-col">
            <button type="button" className={item} onClick={() => (close(), onSave())} disabled={saving}>
              <Save className="size-4" /> Save <span className="ml-auto text-xs text-slate-400">Ctrl+S</span>
            </button>
            <button type="button" className={item} onClick={() => (close(), onPreview())}>
              <Eye className="size-4" /> Preview
            </button>
            <button type="button" className={item} onClick={() => (close(), onPrint())}>
              <Printer className="size-4" /> Print / Save as PDF
            </button>
            <button type="button" className={item} onClick={() => (close(), onDownload())} disabled={downloading}>
              <Download className="size-4" /> Download .docx
            </button>
            <div className="my-1 border-t border-slate-100" />
            <Link href={backHref} className={item} onClick={close}>
              <ArrowLeft className="size-4" /> Close
            </Link>
          </div>
        )}
      </Dropdown>

      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={150}
        aria-label="Template name"
        placeholder="Untitled template"
        className="h-8 min-w-0 flex-1 basis-40 rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-slate-900 hover:border-slate-200 focus:border-blue-400 focus:bg-white focus:outline-none sm:max-w-md"
      />

      <div className="ml-auto flex items-center gap-2">
        <SaveStatus state={state} lastSaved={lastSaved} version={version} />
        <Button variant="outline" size="sm" onClick={onPreview}>
          <Eye className="mr-1 size-4" /> <span className="hidden sm:inline">Preview</span>
        </Button>
        <Button variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
          {downloading ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Download className="mr-1 size-4" />}
          <span className="hidden sm:inline">Download</span>
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || state === "saved"}>
          {saving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Save className="mr-1 size-4" />}
          Save
        </Button>
      </div>
    </div>
  );
}
