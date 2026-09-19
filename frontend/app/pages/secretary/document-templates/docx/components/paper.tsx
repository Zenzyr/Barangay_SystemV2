"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DocxPageSettings } from "@/app/types/docxTemplate.type";
import { pageMetricsPx } from "./lib/pageMetrics";
import "./editor.css";

/**
 * A sheet of paper: real page size, margins as padding, optional page
 * background image and faded watermark behind the text. `pages` repeats the
 * background/watermark for every printed page a long document spans.
 */
export function PaperSheet({
  page,
  pages = 1,
  guides,
  className = "",
  contentRef,
  children,
}: {
  page: DocxPageSettings;
  pages?: number;
  /** Draw a hairline where each printed page ends (continuous editing canvas). */
  guides?: boolean;
  className?: string;
  contentRef?: React.Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const m = pageMetricsPx(page);
  const layers = Array.from({ length: Math.max(1, pages) }, (_, i) => i);
  const style = {
    width: m.width,
    minHeight: m.height * Math.max(1, pages),
    paddingTop: m.margins.top,
    paddingRight: m.margins.right,
    paddingBottom: m.margins.bottom,
    paddingLeft: m.margins.left,
    "--page-h": `${m.height}px`,
  } as CSSProperties;

  return (
    <div className={`doc-paper ${guides ? "doc-paper--guides" : ""} ${className}`} style={style}>
      {page.background
        ? layers.map((i) => (
            <div
              key={`bg-${i}`}
              aria-hidden
              className="doc-paper__layer doc-paper__layer--background"
              style={{ top: i * m.height, height: m.height, backgroundImage: `url(${page.background})` }}
            />
          ))
        : null}
      {page.watermark?.src
        ? layers.map((i) => (
            <div
              key={`wm-${i}`}
              aria-hidden
              className="doc-paper__layer doc-paper__layer--watermark"
              style={{ top: i * m.height, height: m.height, backgroundImage: `url(${page.watermark!.src})`, opacity: page.watermark!.opacity ?? 0.12 }}
            />
          ))
        : null}
      <div ref={contentRef} className="doc-paper__content">
        {children}
      </div>
    </div>
  );
}

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5] as const;
export type Zoom = "fit" | (typeof ZOOM_LEVELS)[number];

/** Centers a paper in the workspace and scales it to fit narrow (mobile) screens or a chosen zoom. */
export function ScaledStage({
  paperWidth,
  zoom = "fit",
  children,
  className = "",
  wrapClassName = "",
}: {
  paperWidth: number;
  zoom?: Zoom;
  children: ReactNode;
  className?: string;
  wrapClassName?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [innerHeight, setInnerHeight] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const update = () => setFit(Math.min(1, Math.max(0.2, (outer.clientWidth - 24) / paperWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [paperWidth]);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const update = () => setInnerHeight(inner.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const scale = zoom === "fit" ? fit : zoom;
  return (
    <div ref={outerRef} className={`flex w-full justify-center ${className}`}>
      <div className={`print-sheet-wrap ${wrapClassName}`} style={{ width: paperWidth * scale, height: innerHeight * scale }}>
        <div ref={innerRef} style={{ width: paperWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
