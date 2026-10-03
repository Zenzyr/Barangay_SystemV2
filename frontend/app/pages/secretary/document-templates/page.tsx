"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, FileType, Gavel, type LucideIcon } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { cn } from "@/lib/utils";
import { TemplateEditor } from "@/components/documentTemplate/visualEditor";
import { DocumentTemplateList } from "@/components/documentTemplate/DocumentTemplateList";
import { DocxTemplateList } from "@/components/documentTemplate/DocxTemplateList";
import { DocxTemplateEditorLoader } from "@/components/documentTemplate/DocxTemplateEditorLoader";
import {
  PENDING_PRICE_APPROVALS_KEY,
  PendingPriceApprovals,
  usePendingPriceApprovals,
} from "@/components/documentTemplate/PendingPriceApprovals";

const BASE = "/pages/secretary/document-templates";
const OBJECT_ID = /^[a-f0-9]{24}$/i;

type TabKey = "templates" | "layouts" | "approvals";

const TABS: { key: TabKey; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { key: "templates", label: "Templates & Fees", shortLabel: "Fees", icon: FileText },
  { key: "layouts", label: "Document Layouts", shortLabel: "Layouts", icon: FileType },
  { key: "approvals", label: "Price Approvals", shortLabel: "Approvals", icon: Gavel },
];

const isTab = (value: string | null): value is TabKey =>
  value === "templates" || value === "layouts" || value === "approvals";

const editHref = (id: string) => `${BASE}?edit=${id}`;
const docxHref = (id: string, preview?: boolean) => `${BASE}?docx=${id}${preview ? "&preview=1" : ""}`;

function DocumentTemplatesWorkspace() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const pending = usePendingPriceApprovals();

  const editId = params.get("edit");
  const docxId = params.get("docx");
  const creating = params.get("create") === "1";
  const tabParam = params.get("tab");
  const tab: TabKey = isTab(tabParam) ? tabParam : "templates";

  const handleSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PENDING_PRICE_APPROVALS_KEY });
  }, [queryClient]);

  if (docxId && OBJECT_ID.test(docxId)) {
    return (
      <div className="h-[calc(100dvh-80px)] md:h-dvh">
        <DocxTemplateEditorLoader
          id={docxId}
          startInPreview={params.get("preview") === "1"}
          backHref={`${BASE}?tab=layouts`}
        />
      </div>
    );
  }

  if (creating) {
    return <TemplateEditor isCreate onSaved={handleSaved} />;
  }

  if (editId && OBJECT_ID.test(editId)) {
    return <TemplateEditor key={editId} isCreate={false} templateId={editId} onSaved={handleSaved} />;
  }

  const pendingCount = pending.data?.length ?? 0;

  const selectTab = (next: TabKey) => {
    router.replace(next === "templates" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <BackButton />
        <h1 className="text-2xl font-bold">Document Templates</h1>
        <p className="text-sm text-muted-foreground">
          Manage document fees, PDF templates and printable layouts. Price changes take effect after Super Admin approval.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Document template sections"
        className="grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:flex sm:w-fit"
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls={`panel-${t.key}`}
              onClick={() => selectTab(t.key)}
              className={cn(
                "flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors sm:gap-2 sm:px-3",
                active ? "bg-white text-sky-700 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900",
              )}
            >
              <t.icon className={cn("hidden size-4 shrink-0 sm:block", active ? "text-emerald-600" : "text-slate-400")} />
              <span className="truncate sm:hidden">{t.shortLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {t.key === "approvals" && pendingCount > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700 tabular-nums">{pendingCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "templates" ? (
          <div className="space-y-4">
            {pendingCount > 0 ? (
              <Link
                href={`${BASE}?tab=approvals`}
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-amber-100/70"
              >
                <Gavel className="size-4 shrink-0" />
                <span>
                  <strong>{pendingCount}</strong> price change{pendingCount === 1 ? " is" : "s are"} awaiting Super Admin approval.
                </span>
                <span className="ml-auto shrink-0 text-xs font-medium underline-offset-2 hover:underline">View approvals</span>
              </Link>
            ) : null}
            <DocumentTemplateList createHref={`${BASE}?create=1`} editHref={editHref} />
          </div>
        ) : tab === "layouts" ? (
          <DocxTemplateList editHref={docxHref} />
        ) : (
          <PendingPriceApprovals />
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentTemplatesWorkspace />
    </Suspense>
  );
}
