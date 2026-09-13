/**
 * Template-driven specs for reproducing official barangay documents 1:1.
 *
 * Coordinates/sizes/fonts were measured from the source-of-truth PDFs in
 * `document/` (see the analysis of `Barangay Clearance.pdf` and
 * `Certificate of Indigency.pdf`). All coordinates are pdf-lib user space
 * (origin bottom-left):
 *   - drawText  → x/y is the BASELINE of the text
 *   - drawImage → x/y is the bottom-left corner of the image
 *   - fill boxes span y..y+h (bottom..top)
 */

// ── Element types ─────────────────────────────────────────────────
export interface TemplateAnchor {
  x: number;
  y: number;
  size: number;
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Font family for the text. Defaults to "times". */
  font?: "helvetica" | "times";
}

export interface TemplateBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** documentRequest field key whose value fills this box */
  field: string;
  /** Optional format override passed to the field formatter */
  format?: string;
  /** Size of the box's value text (pdf-lib StandardFonts Helvetica) */
  size?: number;
  /** Horizontal padding from box left edge to the value's left edge */
  padX?: number;
  /** Baseline offset from box bottom edge to the value's baseline */
  baselineOffset?: number;
  /** Font family for the value. Defaults to "helvetica". */
  font?: "helvetica" | "times";
  /** Fill color of the box (hex). Omit for no fill. */
  fill?: string;
  /** Border color of the box (hex). */
  border?: string;
  borderWidth?: number;
}

export type TemplateShape =
  | { type: "rect"; x: number; y: number; w: number; h: number; color: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; thickness?: number; color: string };

export interface TemplateImage {
  /** Asset path under `/assets/document-template/<type>/...` */
  asset: string;
  /** Optional role so a settings-provided logo/seal/background overrides the baked-in one */
  role?: "background" | "seal" | "logo";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TemplateSignature {
  label?: string;
  labelX: number;
  labelY: number;
  labelSize: number;
  /** Render the signature label in italics (matches the official template). */
  labelItalic?: boolean;
  /** Official position that signs (resolved from activeByPosition) */
  position: string;
  prefix: string;
  nameX: number;
  nameY: number;
  nameSize: number;
  nameBold?: boolean;
  titleX: number;
  titleY: number;
  titleSize: number;
  /** Override the title text drawn below the name (defaults to `position`). */
  titleText?: string;
  /** Optional signature image coordinates (drawn between label and name). */
  sigImageX?: number;
  sigImageY?: number;
  sigImageW?: number;
  sigImageH?: number;
  /** Optional signature line under the name */
  line?: { x1: number; y1: number; x2: number; y2: number };
  /** Font family for the label/name/title. Defaults to "times". */
  font?: "helvetica" | "times";
}

/** One fixed slot in the officials sidebar of a document (e.g. the certification roster). */
export interface TemplateRosterEntry {
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  italic?: boolean;
  /** Render the resolved official name in ALL CAPS. */
  uppercase?: boolean;
  /** Static label drawn verbatim — no official lookup. */
  static?: string;
  /** Official position whose active name is drawn here. */
  position?: string;
  /** For multi-holder positions (e.g. Barangay Kagawad), 0-based index into the precedence-sorted names. */
  index?: number;
}

export interface TemplateSpec {
  document: string;
  /** Page size [w, h] */
  page: [number, number];
  images?: TemplateImage[];
  shapes?: TemplateShape[];
  anchors?: TemplateAnchor[];
  boxes?: TemplateBox[];
  /** Primary signatory block (backward compatible). */
  signature?: TemplateSignature;
  /** One or more signatory blocks (a document may have "Prepared by" and "Certified by"). */
  signatures?: TemplateSignature[];
  /** Officials roster column (a sidebar listing active officials by slot). */
  roster?: TemplateRosterEntry[];
}

// ── Barangay Clearance (document/Barangay Clearance.pdf) ───────────
const CLEARANCE_BOX_FILL = "#ccd7ff";
const CLEARANCE_BOX_BORDER = "#1a1a1a";

const BARANGAY_CLEARANCE: TemplateSpec = {
  document: "barangayClearance",
  page: [612, 792],
  anchors: [
    { x: 241.2, y: 732, size: 11, text: "Republic of the Philippines", font: "helvetica" },
    { x: 254.9, y: 718, size: 11, text: "Province of {barangayProvince}", font: "helvetica" },
    { x: 250.7, y: 704, size: 11, text: "Municipality of {barangayMunicipality}", font: "helvetica" },
    { x: 264.7, y: 690, size: 11, text: "{barangayName}", font: "helvetica" },
    { x: 225.3, y: 676, size: 11, text: "Office of the Punong Barangay", bold: true, font: "helvetica" },
    { x: 219.7, y: 636, size: 14, text: "BARANGAY CLEARANCE", bold: true, font: "helvetica" },
    { x: 72, y: 596, size: 11, text: "TO WHOM IT MAY CONCERN:", font: "helvetica" },
    // line 1
    { x: 72, y: 566, size: 11, text: "This is to certify that", font: "helvetica" },
    { x: 420, y: 566, size: 11, text: ", of legal status", font: "helvetica" },
    // line 2
    { x: 210, y: 536, size: 11, text: ", born on", font: "helvetica" },
    { x: 400, y: 536, size: 11, text: ", and a", font: "helvetica" },
    // line 3
    { x: 72, y: 506, size: 11, text: "resident of", font: "helvetica" },
    // line 4
    { x: 72, y: 476, size: 11, text: "for", font: "helvetica" },
    { x: 160, y: 476, size: 11, text: "year(s), is known to this office to be of good", font: "helvetica" },
    // line 5
    { x: 72, y: 454, size: 11, text: "moral character and standing in the community.", font: "helvetica" },
    // line 6
    { x: 72, y: 420, size: 11, text: "This clearance is issued upon the request of the above-named person", font: "helvetica" },
    // line 7
    { x: 72, y: 400, size: 11, text: "for the purpose of", font: "helvetica" },
    // line 8
    { x: 72, y: 370, size: 11, text: "and for whatever legal purpose it may serve.", font: "helvetica" },
    // line 9
    { x: 72, y: 340, size: 11, text: "Issued this", font: "helvetica" },
    // line 10
    { x: 72, y: 318, size: 11, text: "at {barangayName}, {barangayMunicipality}, {barangayProvince}.", font: "helvetica" },
  ],
  boxes: [
    { x: 190.5, y: 562.5, w: 219, h: 15, field: "fullName", size: 10, padX: 1.5, baselineOffset: 4, fill: CLEARANCE_BOX_FILL, border: CLEARANCE_BOX_BORDER, borderWidth: 1 },
    { x: 72.5, y: 532.5, w: 129, h: 15, field: "civilStatus", size: 10, padX: 1.5, baselineOffset: 4, fill: CLEARANCE_BOX_FILL, border: CLEARANCE_BOX_BORDER, borderWidth: 1 },
    { x: 260.5, y: 532.5, w: 129, h: 15, field: "dateOfBirth", format: "date-iso", size: 10, padX: 1.5, baselineOffset: 4, fill: CLEARANCE_BOX_FILL, border: CLEARANCE_BOX_BORDER, borderWidth: 1 },
    { x: 130.5, y: 502.5, w: 349, h: 15, field: "address", size: 10, padX: 1.5, baselineOffset: 4, fill: CLEARANCE_BOX_FILL, border: CLEARANCE_BOX_BORDER, borderWidth: 1 },
    { x: 92.5, y: 472.5, w: 59, h: 15, field: "yrsOfResidency", format: "number", size: 10, padX: 1.5, baselineOffset: 4, fill: CLEARANCE_BOX_FILL, border: CLEARANCE_BOX_BORDER, borderWidth: 1 },
    { x: 178.5, y: 396.5, w: 319, h: 15, field: "purpose", size: 10, padX: 1.5, baselineOffset: 4, fill: CLEARANCE_BOX_FILL, border: CLEARANCE_BOX_BORDER, borderWidth: 1 },
    { x: 145.5, y: 336.5, w: 219, h: 15, field: "dateIssued", format: "date-phrase", size: 10, padX: 1.5, baselineOffset: 4, fill: CLEARANCE_BOX_FILL, border: CLEARANCE_BOX_BORDER, borderWidth: 1 },
  ],
  signature: {
    label: "Certified by:",
    labelX: 352,
    labelY: 270,
    labelSize: 10,
    position: "Punong Barangay",
    prefix: "HON.",
    nameX: 352,
    nameY: 225,
    nameSize: 11,
    nameBold: true,
    titleX: 352,
    titleY: 212,
    titleSize: 10,
    sigImageX: 302,
    sigImageY: 240,
    sigImageW: 100,
    sigImageH: 18,
    font: "helvetica",
  },
};

// ── Certificate of Indigency (document/Certificate of Indigency.pdf) ─
const CERTIFICATE_OF_INDIGENCY: TemplateSpec = {
  document: "certificateOfIndigency",
  page: [612, 792],
  images: [
    { asset: "/assets/document-template/indigency/background.png", role: "background", x: 114.5, y: 270.9, w: 324, h: 432 },
    { asset: "/assets/document-template/indigency/seal-left.png", role: "seal", x: 72.5, y: 548.6, w: 51, h: 51 },
    { asset: "/assets/document-template/indigency/logo-top-right.png", role: "logo", x: 431.1, y: 551.6, w: 53.3, h: 41.5 },
    { asset: "/assets/document-template/indigency/logo-top-right-2.png", x: 391.5, y: 545.6, w: 63.8, h: 53.3 },
  ],
  shapes: [
    // hairline rule under the letterhead (measured from the reference)
    { type: "rect", x: 41.16, y: 504.07, w: 544.08, h: 0.72, color: "#000000" },
  ],
  anchors: [
    { x: 173.4, y: 591.2, size: 12, text: "Republic of the Philippines", font: "helvetica" },
    { x: 191.8, y: 576.6, size: 12, text: "Province of {barangayProvince}", font: "helvetica" },
    { x: 181.0, y: 561.9, size: 12, text: "Municipality of {barangayMunicipality}", font: "helvetica" },
    { x: 199.1, y: 547.3, size: 12, text: "{barangayName}", font: "helvetica" },
    { x: 211.1, y: 528.9, size: 16, text: "Office of the Punong Barangay", bold: true, font: "helvetica" },
    { x: 150.6, y: 450.8, size: 18, text: "CERTIFICATE OF INDIGENCY", bold: true, font: "helvetica" },
    { x: 42.6, y: 397.9, size: 16, text: "To Whom It May Concern;", font: "helvetica" },
    // body (first line has a first-line indent; the name/date fill the blank runs)
    { x: 81.5, y: 360.6, size: 14, text: "This is to certify that ________________________________as per records available in", font: "helvetica" },
    { x: 42.6, y: 343.5, size: 14, text: "this office, a bonafide resident of this Barangay.", font: "helvetica" },
    { x: 81.5, y: 309.4, size: 14, text: "Further said person belongs to an Indigent family and has no stable source of", font: "helvetica" },
    { x: 42.6, y: 292.3, size: 14, text: "income.", font: "helvetica" },
    { x: 78.6, y: 258.1, size: 14, text: "Any help or assistance to {assistanceTo} by the duly constituted authorities is greatly", font: "helvetica" },
    { x: 42.6, y: 241.0, size: 14, text: "appreciated.", font: "helvetica" },
    { x: 78.6, y: 206.8, size: 14, text: "Given this ______", font: "helvetica" },
    { x: 182.1, y: 206.8, size: 14, text: "________________ At {barangayName}, {barangayMunicipality}, {barangayProvince}, for all legal", font: "helvetica" },
    { x: 42.6, y: 189.7, size: 14, text: "intents and purposes it may serve.", font: "helvetica" },
  ],
  boxes: [
    // resident name over the reference's blank line (8pt, baseline 363.6)
    { field: "fullName", x: 217, y: 360.6, w: 130, h: 14, size: 8, padX: 0, baselineOffset: 3 },
    // date over the blank line (8pt, baseline 209.6)
    { field: "dateIssued", format: "date-phrase", x: 143, y: 206.6, w: 150, h: 14, size: 8, padX: 0, baselineOffset: 3 },
  ],
  signature: {
    label: "Certified by:",
    labelX: 213.3,
    labelY: 104.3,
    labelSize: 14,
    position: "Punong Barangay",
    prefix: "Hon.",
    nameX: 278.7,
    nameY: 87.1,
    nameSize: 14,
    nameBold: false,
    titleX: 315.6,
    titleY: 70.1,
    titleSize: 14,
    line: { x1: 278.69, y1: 86.2, x2: 461.26, y2: 86.2 },
    sigImageX: 310,
    sigImageY: 88,
    sigImageW: 120,
    sigImageH: 18,
    font: "helvetica",
  },
};

// ── Barangay Certification (document/certification-101-1.docx page 1) ─
// Layout measured from `document/Barangay Certificate (1).pdf` (the filled
// reference). Two-column mix: officials roster + certificate metadata on the
// left, body + prepared/certified blocks on the right. Placement matches the
// reference exactly; names, resident fields and barangay info are dynamic.
const BARANGAY_CERTIFICATION: TemplateSpec = {
  document: "barangayCertification",
  page: [612, 792],
  images: [
    { asset: "/assets/document-template/barangayCertification/background.png", role: "background", x: 120.6, y: 156.2, w: 324, h: 432 },
    { asset: "/assets/document-template/barangayCertification/logo-left.png", role: "logo", x: 42.5, y: 675.3, w: 83.5, h: 78.3 },
    { asset: "/assets/document-template/barangayCertification/seal-right.png", role: "seal", x: 427.6, y: 650.9, w: 98.3, h: 103 },
    { asset: "/assets/document-template/barangayCertification/emblem.png", x: 243.1, y: 590, w: 72, h: 62.2 },
  ],
  anchors: [
    // letterhead
    { x: 192.5, y: 740.2, size: 16, text: "Republic of the Philippines", bold: true },
    { x: 195.8, y: 720.6, size: 16, text: "Province of {barangayProvince}" },
    { x: 195.8, y: 701.1, size: 16, text: "Municipality of {barangayMunicipality}" },
    { x: 196.4, y: 679.7, size: 18, text: "{barangayName}" },
    { x: 150.6, y: 657.7, size: 18, text: "Office of the Punong Barangay", italic: true },
    // header divider lines
    { x: 42.6, y: 620.1, size: 11, text: "___________________________________", bold: true },
    { x: 318.1, y: 620.1, size: 11, text: "__________________________________", bold: true },
    // right column
    { x: 212.3, y: 560.9, size: 14, text: "BARANGAY CERTIFICATION", bold: true },
    { x: 212.3, y: 505.3, size: 12, text: "TO WHOM IT MAY CONCERN:", bold: true },
    // body (wraps exactly like the filled reference)
    { x: 248.3, y: 478.6, size: 11, text: "This is to certify that" },
    { x: 468.5, y: 478.6, size: 11, text: "legal age," },
    { x: 258, y: 465.9, size: 11, text: "is a resident of this barangay. And is personally known to" },
    { x: 212.3, y: 453.3, size: 11, text: "me be a person of Good Moral Character and Integrity, She / He is a" },
    { x: 212.3, y: 440.7, size: 11, text: "law abiding Citizen." },
    { x: 284.3, y: 415.4, size: 11, text: "It is further certified that there is no information that" },
    { x: 212.3, y: 402.7, size: 11, text: "the subject person is a member of any organization and or association" },
    { x: 212.3, y: 390.1, size: 11, text: "that is subversive in nature or one that seeks to overthrow the duly" },
    { x: 212.3, y: 377.4, size: 11, text: "constituted Government of the Philippines." },
    { x: 248.3, y: 352.1, size: 11, text: "This certification is issued upon the request of the herein" },
    { x: 212.3, y: 339.4, size: 11, text: "person for legal intents and purposes." },
    { x: 248.3, y: 314.2, size: 11, text: "Issued this" },
    { x: 404.8, y: 314.2, size: 11, text: "at" },
    { x: 431.5, y: 314.2, size: 11, text: "{barangayName}," },
    { x: 212.3, y: 301.5, size: 11, text: "{barangayMunicipality}, {barangayProvince}." },
  ],
  boxes: [
    { x: 364, y: 475.3, w: 100, h: 14, field: "fullName", size: 9, font: "times", padX: 0, baselineOffset: 6 },
    { x: 210, y: 462.3, w: 100, h: 14, field: "civilStatus", size: 9, font: "times", padX: 0, baselineOffset: 6 },
    { x: 311, y: 310.3, w: 105, h: 14, field: "dateIssued", format: "date-phrase", size: 9, font: "times", padX: 0, baselineOffset: 6 },
  ],
  roster: [
    { x: 42.6, y: 561.8, size: 12, bold: true, position: "Punong Barangay", uppercase: true },
    { x: 42.6, y: 548.6, size: 11, static: "Punong Barangay" },
    { x: 42.6, y: 518.0, size: 11, bold: true, static: "SANGGUNIANG BARANGAY" },
    { x: 46.3, y: 493.1, size: 11, bold: true, static: "MEMBER" },
    { x: 42.6, y: 468.3, size: 11, position: "Barangay Kagawad", index: 0 },
    { x: 42.6, y: 455.5, size: 11, position: "Barangay Kagawad", index: 1 },
    { x: 42.6, y: 442.5, size: 11, position: "Barangay Kagawad", index: 2 },
    { x: 42.6, y: 429.6, size: 11, position: "Barangay Kagawad", index: 3 },
    { x: 42.6, y: 416.7, size: 11, position: "Barangay Kagawad", index: 4 },
    { x: 42.6, y: 403.8, size: 11, position: "Barangay Kagawad", index: 5 },
    { x: 42.6, y: 390.9, size: 11, position: "Barangay Kagawad", index: 6 },
    { x: 42.6, y: 365.1, size: 11, bold: true, position: "SK Chairperson", uppercase: true },
    { x: 42.6, y: 351.6, size: 11, static: "Sk Chairperson" },
    { x: 42.6, y: 324.8, size: 11, bold: true, position: "Barangay Treasurer", uppercase: true },
    { x: 42.6, y: 311.4, size: 11, static: "Barangay Treasurer" },
    { x: 42.6, y: 284.6, size: 11, bold: true, position: "Barangay Secretary", uppercase: true },
    { x: 42.6, y: 271.1, size: 11, static: "Barangay Secretary" },
    { x: 42.6, y: 177.1, size: 11, static: "RES.CERT.NO.__________" },
    { x: 42.6, y: 163.7, size: 11, static: "ISSUED ON:____________" },
    { x: 42.6, y: 150.3, size: 11, static: "ISSUED AT:_____________" },
  ],
  signatures: [
    {
      label: "Prepared by:",
      labelItalic: true,
      labelX: 212.3,
      labelY: 263.3,
      labelSize: 11,
      position: "Barangay Secretary",
      prefix: "",
      nameX: 212.3,
      nameY: 213.3,
      nameSize: 10,
      nameBold: true,
      titleX: 212.3,
      titleY: 201.0,
      titleSize: 10,
      sigImageX: 172.3,
      sigImageY: 236,
      sigImageW: 80,
      sigImageH: 14,
    },
    {
      label: "Certified by:",
      labelItalic: true,
      labelX: 392.4,
      labelY: 263.3,
      labelSize: 11,
      position: "Punong Barangay",
      prefix: "",
      nameX: 392.4,
      nameY: 213.3,
      nameSize: 10,
      nameBold: true,
      titleX: 392.4,
      titleY: 201.0,
      titleSize: 10,
      sigImageX: 352.4,
      sigImageY: 236,
      sigImageW: 80,
      sigImageH: 14,
    },
  ],
};

// ── Certificate of Unemployment (document/Certificate of Unemployment.pdf) ──
// The reference is a form whose letterhead/body/boxes are BAKED into the four
// embedded images; only the five field values are live text (Liberation Sans,
// 10pt). Draw order = content-stream order (big form image, then the seal,
// right-side artwork, and the center badge over its edge).
const CERTIFICATE_OF_UNEMPLOYMENT: TemplateSpec = {
  document: "certificateOfUnemployment",
  page: [612, 792],
  images: [
    {
      asset: "/assets/document-template/unemployment/unemployment-background.png",
      x: 132.07, y: 282.30, w: 294.35, h: 392.47,
    },
    {
      asset: "/assets/document-template/unemployment/unemployment-seal.png",
      x: 93.91, y: 534.68, w: 46.33, h: 46.33,
    },
    {
      asset: "/assets/document-template/unemployment/unemployment-right.png",
      x: 419.61, y: 537.36, w: 48.38, h: 37.70,
    },
    {
      asset: "/assets/document-template/unemployment/unemployment-badge.png",
      x: 383.68, y: 531.91, w: 57.92, h: 48.38,
    },
  ],
  // Value text sits at the exact baseline the reference used (y = baseline,
  // padX = 0, baselineOffset = 0); the boxes themselves are baked into the art.
  boxes: [
    { field: "fullName", x: 187, y: 566.4, w: 1, h: 1, size: 10, font: "helvetica", padX: 0, baselineOffset: 0 },
    { field: "dateOfBirth", x: 124, y: 540.4, w: 1, h: 1, size: 10, font: "helvetica", format: "date-iso", padX: 0, baselineOffset: 0 },
    { field: "address", x: 197, y: 510.4, w: 1, h: 1, size: 10, font: "helvetica", padX: 0, baselineOffset: 0 },
    { field: "purpose", x: 220, y: 400.4, w: 1, h: 1, size: 10, font: "helvetica", padX: 0, baselineOffset: 0 },
    { field: "dateIssued", x: 147, y: 340.4, w: 1, h: 1, size: 10, font: "helvetica", format: "date-phrase", padX: 0, baselineOffset: 0 },
  ],
};

// The FTJ ref is a mostly-live-text letterhead document over a blank page
// (only the two flanking logos + center seal are images; officials are baked
// into the template). The dynamic values exist in the ref as *overlays* that
// sit slightly below the baked sample text, so we replicate that: static
// anchors at baked baselines plus boxes at the overlay baselines.
// NOTE: the ref PDF was produced by a PSD-to-PDF exporter with a non-standard
// width table; we render on the serif slot (closest match; ~4.9% glyph-AA
// residual is inherent and accepted).
const CERTIFICATE_OF_FIRST_TIME_JOBSEEKER: TemplateSpec = {
  document: "certificateOfFirstTimeJobseeker",
  page: [612, 1008],
  images: [
    { asset: "/assets/document-template/ftj/ftj-logo-left.png", x: 196.4, y: 908.2, w: 54.8, h: 51 },
    { asset: "/assets/document-template/ftj/ftj-logo-right.png", x: 385.6, y: 910.5, w: 47.4, h: 48.7 },
    { asset: "/assets/document-template/ftj/ftj-seal.png", x: 277.9, y: 896.2, w: 56.3, h: 63 },
  ],
  anchors: [
    { x: 236.8, y: 879.0, size: 12, font: "times", text: "Republic of the Philippines" },
    { x: 252.8, y: 865.2, size: 12, font: "times", text: "Province of La Union" },
    { x: 220.6, y: 851.4, size: 12, font: "times", bold: true, text: "MUNICIPALITY OF ROSARIO" },
    { x: 252.1, y: 837.6, size: 12, font: "times", text: "Barangay Rabon" },
    { x: 204.1, y: 823.8, size: 12, font: "times", bold: true, text: "OFFICE OF PUNONG BARANGAY" },
    { x: 177.7, y: 768.6, size: 16, font: "times", bold: true, text: "BARANGAY CERTIFICATION" },
    { x: 185.1, y: 744.8, size: 12, font: "times", text: "(First Time Jobseekers Assistance Act – RA 11261)" },
    { x: 72.0, y: 697.3, size: 12, font: "times", text: "THIS IS TO CERTIFY THAT: " },
    { x: 326.0, y: 697.3, size: 12, font: "times", text: " a resident of Barangay Rabon, Rosario, La Union for " },
    { x: 36.0, y: 682.4, size: 12, font: "times", text: "years old, is a qualified of RA 11261 or the First Time Jobseekers Act of 2019." },
    { x: 72.0, y: 659.6, size: 12, font: "times", text: "I further certify that the holder/bearer was informed of his/her rights, including duties and responsibilities accorded by" },
    { x: 36.0, y: 644.7, size: 12, font: "times", text: "RA 11261 through the Oath of Undertaking he/she has signed and executed in the presence of our Barangay officials." },
    { x: 72.0, y: 621.8, size: 12, font: "times", text: "Signed this " },
    { x: 134.4, y: 624.8, size: 8, font: "times", text: "TH" },
    { x: 147.7, y: 621.8, size: 12, font: "times", text: "day of " },
    { x: 272.5, y: 621.8, size: 12, font: "times", text: " in Barangay Rabon, Rosario, La Union." },
    { x: 72.0, y: 599.0, size: 12, font: "times", text: "This certification is valid only for one (1) year from the issuance." },
  ],
  // Overlay baselines: the dynamic fills sit ~5.6pt below the baked sample text.
  boxes: [
    { field: "fullName", x: 205.5, y: 691.7, w: 1, h: 1, size: 12, font: "helvetica", padX: 0, baselineOffset: 0 },
    { field: "age", x: 548, y: 697.3, w: 1, h: 1, size: 12, font: "helvetica", format: "number", padX: 0, baselineOffset: 0 },
    { field: "dateIssued", x: 121.5, y: 616.7, w: 1, h: 1, size: 12, font: "helvetica", format: "date-phrase", padX: 0, baselineOffset: 0 },
  ],
  signatures: [
    {
      label: "Certified by:",
      labelX: 279.8,
      labelY: 528.3,
      labelSize: 12,
      position: "Punong Barangay",
      prefix: "HON.",
      nameX: 376.5,
      nameY: 481.5,
      nameSize: 12,
      nameBold: true,
      titleX: 406.3,
      titleY: 466.9,
      titleSize: 12,
      titleText: "Barangay Captain",
      sigImageX: 336.5,
      sigImageY: 505,
      sigImageW: 80,
      sigImageH: 20,
      font: "times",
    },
    {
      label: "Witnessed by:",
      labelX: 284.0,
      labelY: 399.5,
      labelSize: 11,
      position: "Barangay Secretary",
      prefix: "",
      nameX: 360.1,
      nameY: 387.2,
      nameSize: 11,
      nameBold: true,
      titleX: 380.6,
      titleY: 374.4,
      titleSize: 10,
      sigImageX: 340.1,
      sigImageY: 392,
      sigImageW: 40,
      sigImageH: 12,
      font: "times",
    },
  ],
};

// ── Registry ───────────────────────────────────────────────────────
export const templateSpecs: TemplateSpec[] = [
  BARANGAY_CLEARANCE,
  CERTIFICATE_OF_INDIGENCY,
  BARANGAY_CERTIFICATION,
  CERTIFICATE_OF_UNEMPLOYMENT,
  CERTIFICATE_OF_FIRST_TIME_JOBSEEKER,
];

export const getTemplateSpec = (document: string): TemplateSpec | undefined =>
  templateSpecs.find((t) => t.document === document);