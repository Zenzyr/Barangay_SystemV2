"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  createTemplate,
  updateTemplate,
  getTemplate,
  DYNAMIC_FIELD_GROUPS,
  FIELD_LABEL,
  type DocumentTemplate,
  type TemplateElement,
} from "@/app/utils/documentTemplateService";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Type,
  Braces,
  Image as ImageIcon,
  PenLine,
  Minus,
  Square,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Loader2,
} from "lucide-react";

export const DOCUMENT_TYPE_OPTIONS = [
  { value: "barangayCertificate", label: "Barangay Certificate" },
  { value: "certificateOfResidency", label: "Certificate of Residency" },
  { value: "certificateOfIndigency", label: "Certificate of Indigency" },
  {
    value: "certificateOfGoodMoralCharacter",
    label: "Certificate of Good Moral Character",
  },
  { value: "certificateOfUnemployment", label: "Certificate of Unemployment" },
  { value: "barangayBusinessClearance", label: "Barangay Business Clearance" },
  { value: "certificateOfAttestation", label: "Certificate of Attestation" },
  {
    value: "certificationOfTreesCutting",
    label: "Certification of Trees Cutting",
  },
  { value: "barangayCertification", label: "Barangay Certification" },
  {
    value: "certificateOfFirstTimeJobseeker",
    label: "Certificate of First-Time Jobseeker",
  },
  { value: "firstTimeJobseekerOath", label: "First-Time Jobseeker Oath" },
  { value: "certificateOfLowIncome", label: "Certificate of Low Income" },
  { value: "endorsementLetter", label: "Endorsement Letter" },
];

// 1pt = 96/72 px so A4 (595×842pt) maps to 793×1123px.
const PT = 96 / 72;

const PAGE_DIMS: Record<string, { w: number; h: number }> = {
  A4: { w: 595, h: 842 },
  LETTER: { w: 612, h: 792 },
};

const FONT_OPTIONS = [
  "Times New Roman",
  "Georgia",
  "Arial",
  "Helvetica",
  "Courier New",
  "Tahoma",
  "Verdana",
];

const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const defaultElement = (
  type: TemplateElement["type"],
  pageW: number,
  pageH: number,
): TemplateElement => {
  switch (type) {
    case "text":
      return {
        id: uid(),
        type,
        content: "Sample text",
        x: 60,
        y: 120,
        width: pageW - 120,
        height: 60,
        fontSize: 12,
        fontFamily: "Times New Roman",
        color: "#000000",
        alignment: "justify",
        lineHeight: 1.6,
        zIndex: 0,
        wrapText: true,
      };
    case "dynamicText":
      return {
        id: uid(),
        type,
        field: "resident.fullName",
        x: 60,
        y: 120,
        width: 260,
        height: 24,
        fontSize: 12,
        fontFamily: "Times New Roman",
        color: "#000000",
        lineHeight: 1.4,
        zIndex: 0,
      };
    case "image":
      return {
        id: uid(),
        type,
        source: "",
        x: 40,
        y: 40,
        width: 120,
        height: 120,
        imageFit: "contain",
        zIndex: 0,
      };
    case "signature":
      return {
        id: uid(),
        type,
        signaturePosition: "Punong Barangay",
        width: 220,
        height: 90,
        x: Math.round(pageW / 2 - 110),
        y: pageH - 180,
        zIndex: 0,
      };
    case "line":
      return {
        id: uid(),
        type,
        strokeColor: "#000000",
        strokeWidth: 1,
        x: 60,
        y: 300,
        width: pageW - 120,
        height: 1,
        zIndex: 0,
      };
    case "rect":
      return {
        id: uid(),
        type,
        borderColor: "#000000",
        borderWidth: 1,
        backgroundColor: "#ffffff",
        x: 60,
        y: 300,
        width: 200,
        height: 120,
        zIndex: 0,
      };
    case "table":
      return {
        id: uid(),
        type,
        rows: [
          { label: "", value: "" },
          { label: "", value: "" },
        ],
        x: 60,
        y: 300,
        width: pageW - 120,
        height: 80,
        zIndex: 0,
      };
  }
};

const numberOr = (v: string, fallback: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

function FieldSelect({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={compact ? "h-8 text-sm" : ""}>
        <SelectValue placeholder="Select field" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(DYNAMIC_FIELD_GROUPS).map(([group, fields]) => (
          <div key={group}>
            <p className="px-2 py-1 text-xs font-semibold capitalize">
              {group} fields
            </p>
            {Object.entries(fields).map(([field, label]) => (
              <SelectItem key={`${group}.${field}`} value={`${group}.${field}`}>
                {label}
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step ?? 1}
        disabled={disabled}
        onChange={(e) => onChange(numberOr(e.target.value, value))}
        className="h-8"
      />
    </div>
  );
}

interface ElementCanvasProps {
  el: TemplateElement;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<TemplateElement>) => void;
}

function ElementCanvas({
  el,
  selected,
  onSelect,
  onChange,
}: ElementCanvasProps) {
  const dragRef = useRef<{
    mode: "move" | "resize";
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
  } | null>(null);

  const beginDrag = (e: React.PointerEvent, mode: "move" | "resize") => {
    e.stopPropagation();
    onSelect(el.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode,
      sx: e.clientX,
      sy: e.clientY,
      ox: el.x,
      oy: el.y,
      ow: el.width,
      oh: el.height,
    };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / PT;
    const dy = (e.clientY - d.sy) / PT;
    if (d.mode === "move") {
      onChange(el.id, {
        x: Math.max(0, Math.round(d.ox + dx)),
        y: Math.max(0, Math.round(d.oy + dy)),
      });
    } else {
      onChange(el.id, {
        width: Math.max(10, Math.round(d.ow + dx)),
        height: Math.max(10, Math.round(d.oh + dy)),
      });
    }
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const style: React.CSSProperties = {
    position: "absolute",
    left: el.x * PT,
    top: el.y * PT,
    width: el.width * PT,
    height: el.height * PT,
    zIndex: (el.zIndex ?? 0) + 100,
    cursor: selected ? "move" : "pointer",
    outline: selected ? "1.5px dashed #0ea5e9" : "1px solid rgb(226,232,240)",
    outlineOffset: 1,
  };

  const renderBody = () => {
    switch (el.type) {
      case "text": {
        const fs = (el.fontSize ?? 12) * PT;
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              fontFamily: el.fontFamily || "Times New Roman",
              fontSize: fs,
              fontWeight: el.fontWeight || "normal",
              fontStyle: el.fontStyle || "normal",
              textDecoration: el.underline ? "underline" : "none",
              color: el.color || "#000",
              textAlign: el.alignment || "left",
              lineHeight: el.lineHeight || 1.6,
              whiteSpace: el.wrapText === false ? "nowrap" : "pre-wrap",
              letterSpacing: el.letterSpacing ?? 0,
              padding: "2px",
            }}
          >
            {el.content}
          </div>
        );
      }
      case "dynamicText": {
        const fs = (el.fontSize ?? 12) * PT;
        const fieldLabel = el.field ? FIELD_LABEL(el.field) : "Dynamic field";
        return (
          <div
            className="flex items-center rounded-sm"
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              background: "rgba(14,165,233,0.08)",
              border: "1px dashed rgba(14,165,233,0.4)",
              fontFamily: el.fontFamily || "Times New Roman",
              fontSize: fs,
              fontWeight: el.fontWeight || "normal",
              color: "#0369a1",
              textAlign: el.alignment || "left",
              lineHeight: 1.4,
              padding: "2px 4px",
            }}
          >
            <span className="truncate">
              {"{{"}
              {fieldLabel}
              {"}}"}
            </span>
          </div>
        );
      }
      case "image":
        return el.source ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={el.source}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: (el.imageFit === "stretch"
                ? "fill"
                : el.imageFit) as React.CSSProperties["objectFit"],
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 border border-dashed border-slate-300 text-slate-400">
            <ImageIcon className="size-5" />
          </div>
        );
      case "signature":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: "0 6px 6px",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #000",
                height: 4,
                marginBottom: 6,
              }}
            />
            <p
              style={{ fontSize: 9 * PT, fontWeight: "bold", lineHeight: 1.2 }}
            >
              {el.signaturePosition || "Punong Barangay"}
            </p>
          </div>
        );
      case "line":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: el.strokeColor || "#000",
            }}
          />
        );
      case "rect":
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              border: `${el.borderWidth || 1}px solid ${el.borderColor || "#000"}`,
              background: el.backgroundColor || "transparent",
              borderRadius: 0,
            }}
          />
        );
      case "table": {
        const rows =
          el.rows && el.rows.length ? el.rows : [{ label: "", value: "" }];
        return (
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              border: "1px solid #000",
              fontSize: (el.fontSize ?? 10) * PT,
              fontFamily: el.fontFamily || "Times New Roman",
            }}
          >
            <div
              className="flex"
              style={{ borderBottom: "1px solid #000", fontWeight: "bold" }}
            >
              <div className="flex-1 px-1" style={{ width: "40%" }}>
                Label
              </div>
              <div
                className="flex-1 px-1"
                style={{ borderLeft: "1px solid #000" }}
              >
                Value
              </div>
            </div>
            {rows.map((row, i) => (
              <div
                key={i}
                className="flex"
                style={{
                  borderBottom: i < rows.length - 1 ? "1px solid #000" : "none",
                }}
              >
                <div className="flex-1 px-1">{row.label}</div>
                <div
                  className="flex-1 px-1"
                  style={{ borderLeft: "1px solid #000" }}
                >
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        );
      }
    }
  };

  return (
    <div
      style={style}
      onPointerDown={(e) => beginDrag(e, "move")}
      onPointerMove={onMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {renderBody()}
      {selected && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-sky-500 border border-white cursor-se-resize"
          onPointerDown={(e) => beginDrag(e, "resize")}
        />
      )}
    </div>
  );
}

interface TemplateEditorProps {
  isCreate: boolean;
  templateId?: string;
  onSaved: () => void;
}

export function TemplateEditor({
  isCreate,
  templateId,
  onSaved,
}: TemplateEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: fetched, isLoading } = useQuery({
    queryKey: ["document-template", templateId],
    queryFn: () =>
      templateId ? getTemplate(templateId) : Promise.resolve(null),
    enabled: !!templateId,
  });

  const [template, setTemplate] = useState<DocumentTemplate | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [saving, setSaving] = useState(false);

  const initDraft = useCallback((base: DocumentTemplate): DocumentTemplate => {
    const dims = PAGE_DIMS[base.page.size] || PAGE_DIMS.A4;
    return {
      ...base,
      page: {
        size: base.page.size || "A4",
        orientation: base.page.orientation || "portrait",
        unit: "pt",
        margins: base.page.margins || {
          top: 56,
          right: 56,
          bottom: 56,
          left: 56,
        },
        background: base.page.background,
        watermark: base.page.watermark,
      },
      fee: base.fee ?? 0,
      currency: base.currency || "PHP",
      status: base.status || "active",
      version: base.version ?? 1,
      elements: base.elements?.length ? base.elements : [],
      documentType: base.documentType || "",
    };
  }, []);

  if (fetched && !template && !initialized) {
    setTemplate(initDraft(fetched));
    setInitialized(true);
  } else if (isCreate && !fetched && !template && !initialized) {
    setTemplate(
      initDraft({
        _id: "",
        name: "",
        description: "",
        documentType: "",
        fee: 30,
        currency: "PHP",
        status: "active",
        isDefault: false,
        version: 1,
        page: {
          size: "A4",
          orientation: "portrait",
          unit: "pt",
          margins: { top: 56, right: 56, bottom: 56, left: 56 },
        },
        elements: [],
      } as DocumentTemplate),
    );
    setInitialized(true);
  }

  const pageW = PAGE_DIMS[template?.page.size || "A4"].w;
  const pageH = PAGE_DIMS[template?.page.size || "A4"].h;
  const landscape = (template?.page.orientation || "portrait") === "landscape";

  const updateTemplateInfo = (patch: Partial<DocumentTemplate>) => {
    setTemplate((t) => (t ? { ...t, ...patch } : t));
  };

  const updatePage = (patch: Partial<DocumentTemplate["page"]>) => {
    setTemplate((t) => (t ? { ...t, page: { ...t.page, ...patch } } : t));
  };

  const updateElement = (id: string, patch: Partial<TemplateElement>) => {
    setTemplate((t) =>
      t
        ? {
            ...t,
            elements: t.elements.map((el) =>
              el.id === id ? { ...el, ...patch } : el,
            ),
          }
        : t,
    );
  };

  const removeElement = (id: string) => {
    setTemplate((t) =>
      t ? { ...t, elements: t.elements.filter((el) => el.id !== id) } : t,
    );
    if (selectedId === id) setSelectedId(null);
  };

  const duplicateElement = (id: string) => {
    setTemplate((t) => {
      if (!t) return t;
      const idx = t.elements.findIndex((el) => el.id === id);
      if (idx < 0) return t;
      const copy = {
        ...t.elements[idx],
        id: uid(),
        x: t.elements[idx].x + 12,
        y: t.elements[idx].y + 12,
      };
      const elements = [...t.elements];
      elements.splice(idx + 1, 0, copy);
      return { ...t, elements };
    });
    setSelectedId(id);
  };

  const moveElement = (id: string, dir: -1 | 1) => {
    setTemplate((t) => {
      if (!t) return t;
      const idx = t.elements.findIndex((el) => el.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= t.elements.length) return t;
      const elements = [...t.elements];
      [elements[idx], elements[target]] = [elements[target], elements[idx]];
      return { ...t, elements };
    });
  };

  const addElement = (type: TemplateElement["type"]) => {
    if (!template) return;
    const el = defaultElement(type, pageW, pageH);
    setTemplate((t) => (t ? { ...t, elements: [...t.elements, el] } : t));
    setSelectedId(el.id);
  };

  const addDynamicField = (field: string) => {
    if (!template) return;
    const el = defaultElement("dynamicText", pageW, pageH);
    el.field = field;
    setTemplate((t) => (t ? { ...t, elements: [...t.elements, el] } : t));
    setSelectedId(el.id);
  };

  const selectedElement =
    template?.elements.find((el) => el.id === selectedId) || null;

  const save = async () => {
    if (!template) return;
    if (!template.name.trim()) return errorAlert("Template name is required.");
    if (!template.documentType)
      return errorAlert("Please pick a document type.");
    setSaving(true);
    try {
      const payload: Partial<DocumentTemplate> = {
        ...template,
        elements: template.elements,
      };
      if (isCreate) {
        await createTemplate(payload);
        successAlert("Template created successfully.");
      } else if (templateId) {
        await updateTemplate(templateId, payload);
        successAlert("Template saved successfully.");
      }
      queryClient.invalidateQueries({ queryKey: ["document-templates"] });
      onSaved();
      router.push("/pages/secretary/document-templates");
    } catch {
      errorAlert("Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  const pageSizeCss = landscape
    ? { width: pageH * PT * zoom, height: pageW * PT * zoom }
    : { width: pageW * PT * zoom, height: pageH * PT * zoom };

  const bodyFields = useMemo(() => {
    if (isLoading || !template) return null;
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Template Name</Label>
          <Input
            value={template.name}
            onChange={(e) => updateTemplateInfo({ name: e.target.value })}
            placeholder="e.g. Barangay Certificate"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea
            value={template.description}
            onChange={(e) =>
              updateTemplateInfo({ description: e.target.value })
            }
            placeholder="Short description shown to residents"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Document Type</Label>
            <Select
              value={template.documentType}
              onValueChange={(v) => updateTemplateInfo({ documentType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Fee (&nbsp;{template.currency || "PHP"})</Label>
            <Input
              type="number"
              min={0}
              value={template.fee ?? 0}
              onChange={(e) =>
                updateTemplateInfo({
                  fee: Math.max(0, numberOr(e.target.value, 0)),
                })
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            value={template.status}
            onValueChange={(v) =>
              updateTemplateInfo({ status: v as "active" | "inactive" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }, [isLoading, template, pageW, pageH, updateTemplateInfo]);

  if (isLoading || !template) {
    return (
      <div className="flex items-center justify-center h-screen px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-between w-full max-w-md">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/pages/secretary/document-templates")}
            >
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
            <span className="text-sm text-muted-foreground">
              {isLoading ? "Loading template..." : "Editor"}
            </span>
          </div>
          {isLoading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/pages/secretary/document-templates")}
            >
              <ArrowLeft className="size-4 mr-1" />
              Back to Document Templates
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-0px)] overflow-hidden">
      {/* Left panel: template info + tools + layer list */}
      <div className="w-72 shrink-0 border-r bg-white overflow-y-auto p-5 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              title="Back to Document Templates"
              onClick={() => router.push("/pages/secretary/document-templates")}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <h2 className="text-lg font-bold truncate">
              {isCreate ? "Create Template" : template.name}
            </h2>
          </div>
          {!isCreate && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              v{template.version}
            </span>
          )}
        </div>

        {bodyFields}

        <Separator />

        <div className="space-y-2">
          <Label className="font-semibold text-sm">Page</Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Size</Label>
              <Select
                value={template.page.size}
                onValueChange={(v) =>
                  updatePage({ size: v as "A4" | "LETTER" })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A4">A4</SelectItem>
                  <SelectItem value="LETTER">Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Orientation
              </Label>
              <Select
                value={template.page.orientation}
                onValueChange={(v) =>
                  updatePage({ orientation: v as "portrait" | "landscape" })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Margin T</Label>
              <Input
                type="number"
                className="h-8"
                value={template.page.margins.top}
                onChange={(e) =>
                  updatePage({
                    margins: {
                      ...template.page.margins,
                      top: Math.max(0, numberOr(e.target.value, 0)),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Margin R</Label>
              <Input
                type="number"
                className="h-8"
                value={template.page.margins.right}
                onChange={(e) =>
                  updatePage({
                    margins: {
                      ...template.page.margins,
                      right: Math.max(0, numberOr(e.target.value, 0)),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Margin B</Label>
              <Input
                type="number"
                className="h-8"
                value={template.page.margins.bottom}
                onChange={(e) =>
                  updatePage({
                    margins: {
                      ...template.page.margins,
                      bottom: Math.max(0, numberOr(e.target.value, 0)),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Margin L</Label>
              <Input
                type="number"
                className="h-8"
                value={template.page.margins.left}
                onChange={(e) =>
                  updatePage({
                    margins: {
                      ...template.page.margins,
                      left: Math.max(0, numberOr(e.target.value, 0)),
                    },
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Watermark (optional)
            </Label>
            <Input
              value={template.page.watermark || ""}
              onChange={(e) => updatePage({ watermark: e.target.value })}
              placeholder="e.g. OFFICIAL COPY"
              className="h-8"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <Label className="font-semibold text-sm">Elements</Label>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addElement("text")}
              title="Add text block"
            >
              <Type className="size-3.5 mr-1" />
              Text
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addElement("dynamicText")}
              title="Add dynamic field"
            >
              <Braces className="size-3.5 mr-1" />
              Field
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addElement("image")}
              title="Add image"
            >
              <ImageIcon className="size-3.5 mr-1" />
              Img
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addElement("signature")}
              title="Add signature block"
            >
              <PenLine className="size-3.5 mr-1" />
              Sign
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addElement("line")}
              title="Add a line"
            >
              <Minus className="size-3.5 mr-1" />
              Line
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addElement("rect")}
              title="Add a rectangle"
            >
              <Square className="size-3.5 mr-1" />
              Rect
            </Button>
          </div>
          <div className="pt-1">
            <Label className="text-xs text-muted-foreground">
              Insert dynamic field
            </Label>
            <FieldSelect value={""} onChange={addDynamicField} compact />
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label className="font-semibold text-sm">
            Layers ({template.elements.length})
          </Label>
          {template.elements.length === 0 && (
            <p className="text-sm text-muted-foreground">No elements yet.</p>
          )}
          <div className="space-y-1">
            {template.elements.map((el, i) => (
              <div
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md border cursor-pointer text-sm ${selectedId === el.id ? "border-sky-400 bg-sky-50" : "bg-white"}`}
              >
                <span className="text-muted-foreground text-xs">{i + 1}</span>
                <span className="flex-1 truncate font-mono text-xs">
                  {el.type}
                  {el.type === "dynamicText" && el.field
                    ? ` · ${FIELD_LABEL(el.field)}`
                    : ""}
                </span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-slate-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveElement(el.id, -1);
                  }}
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-slate-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveElement(el.id, 1);
                  }}
                >
                  <ArrowDown className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-slate-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateElement(el.id);
                  }}
                >
                  <Copy className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="text-destructive hover:text-red-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeElement(el.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Center: canvas */}
      <div className="flex-1 bg-slate-100 overflow-auto p-6">
        <div className="flex items-center justify-between gap-3 mb-4 max-w-[820px] mx-auto">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => router.push("/pages/secretary/document-templates")}
            >
              <ArrowLeft className="size-4 mr-1" />
              Back
            </Button>
            <div className="text-sm text-muted-foreground truncate">
              {landscape ? `${pageH}×${pageW}` : `${pageW}×${pageH}`} pt ·{" "}
              {landscape ? "Landscape" : "Portrait"}
              {template.isDefault ? " · Default" : ""}
            </div>
          </div>
          <Select
            value={String(zoom)}
            onValueChange={(v) => setZoom(numberOr(v, 0.8))}
          >
            <SelectTrigger className="w-[90px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.5">50%</SelectItem>
              <SelectItem value="0.65">65%</SelectItem>
              <SelectItem value="0.8">80%</SelectItem>
              <SelectItem value="1">100%</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-center">
          <div
            className="relative bg-white shadow-lg border border-slate-300"
            style={{
              width: pageSizeCss.width,
              height: pageSizeCss.height,
              backgroundImage: template.page.watermark
                ? `repeating-linear-gradient(45deg, transparent 0 6%, rgba(100,116,139,0.06) 6% 12%)`
                : undefined,
            }}
            onPointerDown={() => setSelectedId(null)}
          >
            {template.elements.map((el) => (
              <ElementCanvas
                key={el.id}
                el={el}
                selected={selectedId === el.id}
                onSelect={setSelectedId}
                onChange={updateElement}
              />
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Click to select · drag to move · drag the blue corner handle to resize
        </p>
      </div>

      {/* Right: properties */}
      <div className="w-72 shrink-0 border-l bg-white overflow-y-auto p-5 space-y-4">
        {selectedElement ? (
          <ElementProperties
            el={selectedElement}
            onChange={updateElement}
            onRemove={() => removeElement(selectedElement.id)}
          />
        ) : (
          <div className="text-sm text-muted-foreground text-center py-10">
            Select an element on the canvas to edit its properties.
          </div>
        )}

        <Separator />

        <Button onClick={save} className="w-full" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin mr-2" />}
          {isCreate ? "Create Template" : "Save Changes"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/pages/secretary/document-templates")}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ElementProperties({
  el,
  onChange,
  onRemove,
}: {
  el: TemplateElement;
  onChange: (id: string, patch: Partial<TemplateElement>) => void;
  onRemove: () => void;
}) {
  const patch = (p: Partial<TemplateElement>) => onChange(el.id, p);
  const isLayout = el.type !== "text" && el.type !== "dynamicText";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold capitalize">{el.type} element</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive h-8"
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="X (pt)"
          value={el.x}
          onChange={(n) => patch({ x: n })}
        />
        <NumField
          label="Y (pt)"
          value={el.y}
          onChange={(n) => patch({ y: n })}
        />
        <NumField
          label="Width (pt)"
          value={el.width}
          onChange={(n) => patch({ width: n })}
        />
        <NumField
          label="Height (pt)"
          value={el.height}
          onChange={(n) => patch({ height: n })}
        />
      </div>

      {(el.type === "text" ||
        el.type === "dynamicText" ||
        el.type === "table") && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Font family</Label>
            <Select
              value={el.fontFamily || "Times New Roman"}
              onValueChange={(v) => patch({ fontFamily: v })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Font size (pt)"
              value={el.fontSize ?? 12}
              onChange={(n) => patch({ fontSize: n })}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Align</Label>
              <Select
                value={el.alignment || "left"}
                onValueChange={(v) => patch({ alignment: v as any })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="justify">Justify</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NumField
              label="Line h."
              value={el.lineHeight ?? 1.6}
              onChange={(n) => patch({ lineHeight: n })}
              step={0.1}
            />
            <NumField
              label="Spacing"
              value={el.letterSpacing ?? 0}
              onChange={(n) => patch({ letterSpacing: n })}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <Input
                type="color"
                value={el.color || "#000000"}
                onChange={(e) => patch({ color: e.target.value })}
                className="h-8 p-1"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={el.fontWeight === "bold" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                patch({
                  fontWeight: el.fontWeight === "bold" ? "normal" : "bold",
                })
              }
            >
              <b>B</b>
            </Button>
            <Button
              type="button"
              variant={el.fontStyle === "italic" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                patch({
                  fontStyle: el.fontStyle === "italic" ? "normal" : "italic",
                })
              }
            >
              <i>I</i>
            </Button>
            <Button
              type="button"
              variant={el.underline ? "default" : "outline"}
              size="sm"
              onClick={() => patch({ underline: !el.underline })}
            >
              <u>U</u>
            </Button>
          </div>
        </>
      )}

      {(el.type === "text" || el.type === "table") && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Content</Label>
          {el.type === "text" ? (
            <Textarea
              value={el.content || ""}
              onChange={(e) => patch({ content: e.target.value })}
              rows={8}
              placeholder="Support {{resident.fullName}} style placeholders"
            />
          ) : el.rows ? (
            <div className="space-y-1.5">
              {el.rows.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-1.5">
                  <Input
                    className="h-8 text-xs"
                    value={row.label}
                    placeholder="Label"
                    onChange={(e) =>
                      patch({
                        rows: el.rows!.map((r, j) =>
                          j === i ? { ...r, label: e.target.value } : r,
                        ),
                      })
                    }
                  />
                  <Input
                    className="h-8 text-xs"
                    value={row.value}
                    placeholder="Value"
                    onChange={(e) =>
                      patch({
                        rows: el.rows!.map((r, j) =>
                          j === i ? { ...r, value: e.target.value } : r,
                        ),
                      })
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() =>
                  patch({
                    rows: [...(el.rows || []), { label: "", value: "" }],
                  })
                }
              >
                + Row
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {el.type === "dynamicText" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Dynamic field</Label>
          <FieldSelect
            value={el.field || ""}
            onChange={(v) => patch({ field: v })}
          />
          <p className="text-xs text-muted-foreground">
            Resolved at render time from the resident&apos;s profile,
            certificate, or barangay info.
          </p>
        </div>
      )}

      {el.type === "image" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Image URL / data
          </Label>
          <Input
            className="h-8 text-xs"
            value={el.source || ""}
            onChange={(e) => patch({ source: e.target.value })}
            placeholder="https://... or data:image/..."
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground truncate">
              Fit
            </Label>
            <Select
              value={el.imageFit || "contain"}
              onValueChange={(v) => patch({ imageFit: v as any })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="stretch">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {el.type === "signature" && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Signature position
          </Label>
          <Input
            className="h-8 text-xs"
            value={el.signaturePosition || ""}
            onChange={(e) => patch({ signaturePosition: e.target.value })}
            placeholder="e.g. Punong Barangay"
          />
          <p className="text-xs text-muted-foreground">
            The official&apos;s name is filled in automatically from the
            Officials list.
          </p>
        </div>
      )}

      {(el.type === "line" || el.type === "rect") && (
        <div className="grid grid-cols-2 gap-3">
          {el.type === "line" && (
            <>
              <NumField
                label="Thickness"
                value={el.strokeWidth ?? 1}
                onChange={(n) => patch({ strokeWidth: n })}
                step={0.5}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <Input
                  type="color"
                  value={el.strokeColor || "#000000"}
                  onChange={(e) => patch({ strokeColor: e.target.value })}
                  className="h-8 p-1"
                />
              </div>
            </>
          )}
          {el.type === "rect" && (
            <>
              <NumField
                label="Border w."
                value={el.borderWidth ?? 1}
                onChange={(n) => patch({ borderWidth: n })}
              />
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Border color
                </Label>
                <Input
                  type="color"
                  value={el.borderColor || "#000000"}
                  onChange={(e) => patch({ borderColor: e.target.value })}
                  className="h-8 p-1"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground truncate">
                  Fill color
                </Label>
                <Input
                  type="color"
                  value={el.backgroundColor || "#ffffff"}
                  onChange={(e) => patch({ backgroundColor: e.target.value })}
                  className="h-8 p-1"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
