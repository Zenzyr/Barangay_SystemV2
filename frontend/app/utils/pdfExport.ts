import { PDFDocument } from "pdf-lib";

const COLOR_PROPERTIES = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "column-rule-color",
  "caret-color",
  "fill",
  "stroke",
];

const UNSUPPORTED_COLOR = /(oklch|oklab|lab|lch|color-mix|color)\(/i;

export const PDF_PAGE_SIZES = {
  a4Portrait: { width: 595.28, height: 841.89 },
  a4Landscape: { width: 841.89, height: 595.28 },
};

function createColorResolver() {
  const cache = new Map<string, string>();
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return (value: string) => {
    const cached = cache.get(value);
    if (cached) return cached;
    let resolved = "rgba(0, 0, 0, 0)";
    if (ctx) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      resolved = `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
    }
    cache.set(value, resolved);
    return resolved;
  };
}

function normalizeColors(root: HTMLElement) {
  const view = root.ownerDocument.defaultView;
  if (!view) return;
  const resolve = createColorResolver();
  const elements = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>("*")),
  ];
  for (const el of elements) {
    const style = view.getComputedStyle(el);
    for (const prop of COLOR_PROPERTIES) {
      const value = style.getPropertyValue(prop);
      if (value && UNSUPPORTED_COLOR.test(value)) {
        el.style.setProperty(prop, resolve(value));
      }
    }
    if (UNSUPPORTED_COLOR.test(style.getPropertyValue("box-shadow")))
      el.style.setProperty("box-shadow", "none");
    if (UNSUPPORTED_COLOR.test(style.getPropertyValue("background-image")))
      el.style.setProperty("background-image", "none");
  }
}

export async function renderElementToCanvas(
  element: HTMLElement,
  scale = 2,
): Promise<HTMLCanvasElement> {
  const html2canvas = (await import("html2canvas-pro")).default;
  const marker = `pdf-export-${Math.random().toString(36).slice(2)}`;
  element.setAttribute("data-pdf-export", marker);
  try {
    return await html2canvas(element, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      onclone: (doc) => {
        const clone = doc.querySelector<HTMLElement>(
          `[data-pdf-export="${marker}"]`,
        );
        if (clone) normalizeColors(clone);
      },
    });
  } finally {
    element.removeAttribute("data-pdf-export");
  }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to render the page"));
        return;
      }
      blob.arrayBuffer().then(resolve, reject);
    }, "image/png");
  });
}

export function downloadBytes(
  bytes: Uint8Array,
  fileName: string,
  type = "application/pdf",
) {
  const blob = new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportPagesToPdf(
  pages: HTMLElement[],
  fileName: string,
  options: {
    pageSize?: { width: number; height: number };
    title?: string;
  } = {},
) {
  const pageSize = options.pageSize ?? PDF_PAGE_SIZES.a4Portrait;
  const pdf = await PDFDocument.create();
  if (options.title) pdf.setTitle(options.title);
  pdf.setCreator("BIMS");

  for (const element of pages) {
    const canvas = await renderElementToCanvas(element);
    const png = await pdf.embedPng(await canvasToPngBytes(canvas));
    const page = pdf.addPage([pageSize.width, pageSize.height]);
    const ratio = Math.min(
      pageSize.width / png.width,
      pageSize.height / png.height,
    );
    const width = png.width * ratio;
    const height = png.height * ratio;
    page.drawImage(png, {
      x: (pageSize.width - width) / 2,
      y: pageSize.height - height,
      width,
      height,
    });
  }

  downloadBytes(await pdf.save(), fileName);
}

export async function exportElementToFittedPdf(
  element: HTMLElement,
  fileName: string,
  title?: string,
) {
  const canvas = await renderElementToCanvas(element);
  const pdf = await PDFDocument.create();
  if (title) pdf.setTitle(title);
  pdf.setCreator("BIMS");
  const png = await pdf.embedPng(await canvasToPngBytes(canvas));
  const margin = 24;
  const width = 300;
  const height = (png.height / png.width) * width;
  const page = pdf.addPage([width + margin * 2, height + margin * 2]);
  page.drawImage(png, { x: margin, y: margin, width, height });
  downloadBytes(await pdf.save(), fileName);
}

export async function printElementAsImage(element: HTMLElement, title: string) {
  const canvas = await renderElementToCanvas(element);
  const dataUrl = canvas.toDataURL("image/png");
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(
    `<!DOCTYPE html><html><head><title>${title.replace(/</g, "&lt;")}</title>` +
      `<style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center}img{width:80mm;max-width:100%;height:auto}</style>` +
      `</head><body><img alt="" src="${dataUrl}" /></body></html>`,
  );
  doc.close();
  const img = doc.querySelector("img");
  const print = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  if (img && !img.complete) img.onload = print;
  else print();
}
