import type {
  DocumentPageSettings,
  DocumentPageSize,
} from "@/app/types/documentEditor.type";

export const PAGE_PT: Record<
  DocumentPageSize,
  { w: number; h: number; label: string }
> = {
  A4: { w: 595.28, h: 841.89, label: "A4 (210 × 297 mm)" },
  Letter: { w: 612, h: 792, label: "Letter (8.5 × 11 in)" },
  Legal: { w: 612, h: 1008, label: "Legal (8.5 × 14 in)" },
};

export const ptToPx = (pt: number) => (pt * 4) / 3;

export interface PageMetricsPx {
  width: number;
  height: number;
  margins: { top: number; right: number; bottom: number; left: number };
}

export function pageSizePt(
  page: Pick<DocumentPageSettings, "size"> & {
    orientation?: DocumentPageSettings["orientation"];
  },
) {
  const size = PAGE_PT[page.size] ?? PAGE_PT.Letter;
  return page.orientation === "landscape"
    ? { w: size.h, h: size.w }
    : { w: size.w, h: size.h };
}

export function pageMetricsPx(page: DocumentPageSettings): PageMetricsPx {
  const size = pageSizePt(page);
  const m = page.margins;
  return {
    width: ptToPx(size.w),
    height: ptToPx(size.h),
    margins: {
      top: ptToPx(m.top),
      right: ptToPx(m.right),
      bottom: ptToPx(m.bottom),
      left: ptToPx(m.left),
    },
  };
}

export const humanizeVariable = (key: string) =>
  key
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
