// The six bundled templates, recreated from the .docx files in frontend/docs/.
//
// Each Word file's real text, fonts, sizes, colours, emphasis, alignment,
// indents and page setup are reproduced. Sample data typed into the originals
// (names, dates, incomes...) became {{variables}}; text that is part of the
// document itself stays literal. Certification 101, Endorsement for Scholar,
// and First-Time Jobseeker are each split into individual templates — one per
// certificate. Floating logos are placed in a letterhead table.

import { TiptapNode } from "../../utils/tiptapDoc";
import {
  Style, t, v, p, gap, pageBreak, rule, img, numbered, table, doc, letterhead,
} from "./builders";

export interface SeedTemplate {
  slug: string;
  name: string;
  // Maps this seed to a document request code so generation can render it by
  // type (falls back to the static .docx assets only when not present). Left
  // empty on variant/split templates that duplicate another seed's code.
  documentType?: string;
  originalFilename: string;
  page: {
    size: "A4" | "Letter" | "Legal";
    /** Points. */
    margins: { top: number; right: number; bottom: number; left: number };
    background?: string;
    watermark?: { src: string; opacity: number };
  };
  editorContent: TiptapNode;
}

const ASSET = "/assets/docx-templates/shared";
const px = (pt: number) => Math.round((pt * 4) / 3);

// Repeated phrases.
const DATE_LINE = (lead: string, place: string): (TiptapNode | string)[] => [
  `${lead} `, v("issue_day_ordinal"), " day of ", v("issue_month"), ", ", v("issue_year"), ` ${place}`,
];

// ─────────────────────────────────────────────────────────────────────────
// Certificate of Indigency (Letter)
// ─────────────────────────────────────────────────────────────────────────

interface IndigencyStyles {
  title: Style;
  greeting: Style;
  body: Style;
  /** Style of the first body paragraph (bold in some originals). */
  lead?: Style;
  sig: Style;
  gapAfter: number;
}

const indigencyBlocks = (s: IndigencyStyles, sigLeft: number): TiptapNode[] => {
  const para = (content: (TiptapNode | string)[], style: Style) =>
    p(content, { align: "justify", indent: 36, after: s.gapAfter, style });
  return [
    p("CERTIFICATE OF INDIGENCY", { align: "center", after: s.gapAfter, style: s.title }),
    p("To Whom It May Concern;", { align: "justify", after: s.gapAfter, style: s.greeting }),
    para(
      ["This is to certify that ", v("resident_name", s.lead ?? s.body), " as per records available in this office, a bonafide resident of this Barangay."],
      s.lead ?? s.body
    ),
    para(["Further said person belongs to an indigent family and has no stable source of income."], s.body),
    para(["Any help or assistance to his/her by the duly constituted authorities is greatly appreciated."], s.body),
    para(DATE_LINE("Given this", "At Barangay Rabon, Rosario, La Union, for all legal intents and purposes it may serve."), s.body),
    ...gap(3),
    p("Certified by:", { align: "center", left: sigLeft, style: { ...s.sig, b: true } }),
    p([t("Hon. ", { ...s.sig, b: true, u: true }), v("punong_barangay", { ...s.sig, b: true, u: true })], { align: "center", left: sigLeft }),
    p("Punong Barangay", { align: "center", left: sigLeft, style: s.sig }),
  ];
};

const bookman14 = (extra: Style = {}): Style => ({ font: "Bookman Old Style", size: 14, ...extra });

const indigency: SeedTemplate = (() => {
  const G = "#404040";
  const width = 432;
  return {
    slug: "certificate-of-indigency",
    name: "Certificate of Indigency",
    documentType: "certificateOfIndigency",
    originalFilename: "Certificate_of_Indigency.docx",
    page: { size: "Letter", margins: { top: 72, right: 90, bottom: 72, left: 90 } },
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 84,
        rightWidth: 132,
        left: [img("2b39a1.jpeg", 60, "Seal of the Municipality of Rosario")],
        right: [img("1bf6ef.png", 62, "Bagong Pilipinas"), img("8dd33b.jpeg", 47, "Barangay Rabon seal")],
        lines: [
          p("Republic of the Philippines", { align: "center", style: bookman14() }),
          p("Province of La Union", { align: "center", style: bookman14() }),
          p("Municipality of Rosario", { align: "center", style: bookman14() }),
          p("Barangay Rabon", { align: "center", style: bookman14() }),
          p("Office of the Punong Barangay", { align: "center", style: { size: 16, i: true, color: G } }),
        ],
      }),
      rule(),
      ...gap(2),
      ...indigencyBlocks(
        {
          title: { font: "Britannic Bold", size: 18, b: true, color: G },
          greeting: { size: 16, b: true, color: G },
          body: { size: 14, color: G },
          sig: { size: 14, color: G },
          gapAfter: 17,
        },
        216
      ),
    ]),
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Certificate of Trees Cutting (Letter)
// ─────────────────────────────────────────────────────────────────────────

const treesCutting: SeedTemplate = (() => {
  const width = 468;
  const c14: Style = { size: 14 };
  const c12: Style = { size: 12 };
  return {
    slug: "certificate-of-trees-cutting",
    name: "Certificate of Trees Cutting",
    documentType: "certificationOfTreesCutting",
    originalFilename: "certificate-of-trees-cutting.docx",
    page: { size: "Letter", margins: { top: 72, right: 72, bottom: 72, left: 72 } },
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 84,
        rightWidth: 84,
        left: [img("2b39a1.jpeg", 60, "Seal of the Municipality of Rosario")],
        right: [img("8dd33b.jpeg", 47, "Barangay Rabon seal")],
        lines: [
          p("Republic of the Philippines", { align: "center", style: c14 }),
          p("Province of La Union", { align: "center", style: c14 }),
          p("Municipality of Rosario", { align: "center", style: c14 }),
          p("Barangay Rabon", { align: "center", style: c14 }),
          p("Office of the Punong Barangay", { align: "center", style: c14 }),
        ],
      }),
      rule(),
      ...gap(1, 6),
      p("CERTIFICATION", { align: "center", after: 14, style: { font: "Bodoni MT", size: 16 } }),
      p("To whom it may concern,", { after: 14, style: c14 }),
      p(
        [
          "This is certify that trees applied for cutting is within the lot of ", v("resident_name", c12),
          " with the Title No. ", v("title_no", c12), " and Tax Declaration No.", v("tax_declaration_no", c12),
          " with an area of ", v("land_area", c12), " square meter, this barangay.",
        ],
        { align: "justify", indent: 54, after: 14, style: c12 }
      ),
      p(
        ["Certifying further that said trees were marked and identified to be ", v("tree_count", c12), " ", v("tree_type", c12), "."],
        { align: "justify", indent: 54, after: 14, style: c12 }
      ),
      p(
        ["Issued this ", v("issue_day_ordinal", c12), " day of ", v("issue_month", c12), " ", v("issue_year", c12), " at this Barangay Rabon, Rosario, La Union."],
        { align: "justify", indent: 54, after: 30, style: c12 }
      ),
      p("Very Truly Yours,", { align: "center", after: 24, style: c12 }),
      p([v("punong_barangay", { size: 12, b: true, u: true, caps: true })], { align: "center", left: 250 }),
      p("Punong Barangay", { align: "center", left: 250, style: { size: 11, i: true } }),
    ]),
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Endorsement for Scholar — split into three individual templates
// (Certificate of Low Income, Certificate of Indigency, Endorsement Letter).
// ─────────────────────────────────────────────────────────────────────────

const endorsementWidth = 468;
const endorsementC14: Style = { size: 14 };
const endorsementB16: Style = { size: 16, b: true };
const endorsementP16: Style = { size: 16 };

const endorsementHead = (): TiptapNode =>
  letterhead({
    width: endorsementWidth,
    leftWidth: 84,
    rightWidth: 84,
    left: [img("89dbf7.jpeg", 62, "Seal of the Municipality of Rosario")],
    right: [img("8dd33b.jpeg", 47, "Barangay Rabon seal")],
    lines: [
      p("Republic of the Philippines", { align: "center", style: endorsementC14 }),
      p("Province of La Union", { align: "center", style: endorsementC14 }),
      p("Municipality of Rosario", { align: "center", style: endorsementC14 }),
      p("Barangay Rabon", { align: "center", style: endorsementC14 }),
      p("Office of the Punong Barangay", { align: "center", style: { size: 14, i: true } }),
    ],
  });

const endorsementSig = (): TiptapNode[] => [
  p("Certified by:", { align: "center", left: 230, style: { size: 14, b: true } }),
  p([v("punong_barangay", { size: 14, b: true, u: true, caps: true })], { align: "center", left: 230 }),
  p("Punong Barangay", { align: "center", left: 230, style: endorsementC14 }),
];

const endorsementPage: SeedTemplate["page"] = { size: "Letter", margins: { top: 72, right: 72, bottom: 72, left: 72 } };

// 1 ─ Certificate of Low Income
const endorsementForScholarLowIncome: SeedTemplate = {
  slug: "endorsement-for-scholar-low-income",
  name: "Certificate of Low Income",
  documentType: "certificateOfLowIncome",
  originalFilename: "ENDORSEMENT-FOR-SCHOLAR-low-income.docx",
  page: endorsementPage,
  editorContent: doc([
    endorsementHead(),
    rule(),
    ...gap(1, 6),
    p("CERTIFICATE OF LOW INCOME", { align: "center", after: 20, style: { size: 18, b: true } }),
    p("To Whom It May Concern;", { align: "justify", after: 18, style: endorsementB16 }),
    p(
      [
        "This is to certify that ", v("resident_name", endorsementB16), " and ", v("spouse_name", endorsementB16),
        ", married and a resident of this barangay belongs to indigent families with an annual income of P ", v("annual_income", endorsementB16),
      ],
      { align: "justify", indent: 36, after: 18, style: endorsementB16 }
    ),
    p(
      ["Any help or assistance to their daughter ", v("assistance_to", endorsementB16), " by the duly constituted authorities is greatly appreciated."],
      { align: "justify", indent: 36, after: 18, style: endorsementB16 }
    ),
    p(
      [...DATE_LINE("Given this", "At Barangay Rabon, Rosario, La Union for the purpose of scholarship grant or whatever legal purposes it may serve.")],
      { align: "justify", left: 36, after: 30, style: endorsementB16 }
    ),
    ...endorsementSig(),
  ]),
};

// 2 ─ Certificate of Indigency
const endorsementForScholarIndigency: SeedTemplate = {
  slug: "endorsement-for-scholar-indigency",
  name: "Certificate of Indigency",
  originalFilename: "ENDORSEMENT-FOR-SCHOLAR-indigency.docx",
  page: endorsementPage,
  editorContent: doc([
    endorsementHead(),
    rule(),
    ...gap(1, 6),
    p("CERTIFICATE OF INDIGENCY", { align: "center", after: 20, style: { size: 18, b: true } }),
    p("To Whom It May Concern;", { align: "justify", after: 18, style: endorsementB16 }),
    p(
      ["This is to certify that ", v("resident_name", endorsementB16), " as per records available in this office, is a bonafide resident of this Barangay."],
      { align: "justify", indent: 36, after: 18, style: endorsementB16 }
    ),
    p("Further said person belongs to an indigent family and has no stable source of income.", { align: "justify", indent: 36, after: 18, style: endorsementP16 }),
    p(
      ["Any help or assistance to ", v("assistance_to", endorsementP16), " by the duly constituted authorities is greatly appreciated."],
      { align: "justify", indent: 36, after: 18, style: endorsementP16 }
    ),
    p(DATE_LINE("Given this", "At Barangay Rabon, Rosario, La Union, for all legal intents and purposes it may serve."), {
      align: "justify",
      indent: 36,
      after: 30,
      style: endorsementP16,
    }),
    ...endorsementSig(),
  ]),
};

// 3 ─ Endorsement Letter
const endorsementForScholarLetter: SeedTemplate = {
  slug: "endorsement-for-scholar-letter",
  name: "Endorsement Letter",
  documentType: "endorsementLetter",
  originalFilename: "ENDORSEMENT-FOR-SCHOLAR-letter.docx",
  page: endorsementPage,
  editorContent: doc([
    endorsementHead(),
    rule(),
    ...gap(1, 6),
    p("ENDORSEMENT LETTER", { align: "center", after: 14, style: { size: 18, b: true } }),
    p([v("issue_date", { size: 14, b: true })], { align: "justify", after: 14 }),
    p("Hon. Bellarmin A. Flores II", { style: { size: 14, b: true, u: true } }),
    p("Mayor", { left: 36, style: { size: 14, b: true } }),
    p("Rosario, La Union", { after: 14, style: { size: 14, b: true } }),
    p("Dear Hon. Bellarmin A. Flores,", { align: "justify", after: 14, style: { size: 14, b: true } }),
    p(["This is to endorse ", v("resident_name", endorsementC14), " of ", v("purok", endorsementC14), ", Barangay Rabon Rosario, La Union."], {
      align: "justify",
      indent: 36,
      after: 14,
      style: endorsementC14,
    }),
    p("That I have known this student has a good record and good moral character.", { align: "justify", indent: 36, after: 14, style: endorsementC14 }),
    p("Furthermore, that I will endorse to your good office to having a scholarship as one of your scholar.", {
      align: "justify",
      indent: 36,
      after: 14,
      style: endorsementC14,
    }),
    p(DATE_LINE("Given this", "at Barangay Rabon, Rosario, La Union, for all legal intents and purposes it may serve."), {
      align: "justify",
      indent: 36,
      after: 30,
      style: endorsementC14,
    }),
    ...endorsementSig(),
  ]),
};

// ─────────────────────────────────────────────────────────────────────────
// Attestation Docs (A4, swirl background)
// ─────────────────────────────────────────────────────────────────────────

const attestation: SeedTemplate = (() => {
  const G = "#595959";
  const width = 451;
  const hobo: Style = { font: "Hobo Std", size: 14, b: true, color: G };
  const cg: Style = { font: "Century Gothic", color: G };
  return {
    slug: "attestation-documents",
    name: "Attestation Documents",
    documentType: "certificateOfAttestation",
    originalFilename: "Attestation-Docs.docx",
    page: {
      size: "A4",
      margins: { top: 42, right: 72, bottom: 72, left: 72 },
      background: `${ASSET}/ce38c6.png`,
    },
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 130,
        rightWidth: 80,
        left: [img("e05e85.jpeg", 68, "Seal of the Municipality of Rosario"), img("0347f9.png", 66, "Bagong Pilipinas")],
        right: [img("ed9f16.jpeg", 74, "Barangay Rabon seal")],
        lines: [
          p("Republic of the Philippines", { align: "center", style: hobo }),
          p("Province of La Union", { align: "center", style: hobo }),
          p("Municipality of Rosario", { align: "center", style: hobo }),
          p("Barangay Rabon", { align: "center", after: 14, style: hobo }),
          p("OFFICE OF PUNONG BARANGAY", { align: "center", style: { ...cg, size: 12, b: true } }),
        ],
      }),
      ...gap(2),
      p("CERTIFICATE   OF   ATTESTATION", { align: "center", after: 14, style: { font: "Britannic Bold", size: 20, color: G } }),
      p("TO WHOM IT MAY CONCERN:", { after: 14, style: { ...cg, size: 12, b: true } }),
      p(
        [
          "This is to certify that Mr./Mrs ", v("resident_name", cg), " residing at ", v("address", cg), ", ",
          v("work_status", cg), " at ", v("workplace", cg), " earning a monthly income of Php ", v("monthly_income", cg), ".",
        ],
        { align: "justify", indent: 36, after: 14, style: cg }
      ),
      p(
        [
          "Following a through assessment and validation of the client’s socio-economic profile conducted by the undersigned Barangay Council, it has been determined that Mr./Mrs. ",
          v("resident_name", cg),
          " is an individual receiving income below the regional minimum wage and is facing significant financial challenges because of the effects of inflation, like the rising prices of goods and services. The above - mentioned income remains insufficient to meet the unforeseen expenses ",
          v("expense_type", cg),
          ", on top of the family’s monthly household expenses amounting to Php ",
          v("household_expenses", cg),
          ", thus further straining their limited financial resources.",
        ],
        { align: "justify", indent: 36, after: 14, style: cg }
      ),
      p("This certification is issued upon the request of the above- mention person for whatever legal purpose/s it may serve.", {
        align: "justify",
        indent: 36,
        after: 14,
        style: cg,
      }),
      p([...DATE_LINE("Issued this", "at Barangay Rabon, Rosario, La Union.")].map((n) => (typeof n === "string" ? t(n, cg) : n)), {
        align: "justify",
        indent: 36,
        after: 28,
      }),
      p([t("HON. ", { ...cg, size: 12, b: true, u: true }), v("punong_barangay", { ...cg, size: 12, b: true, u: true, caps: true })], { align: "center" }),
      p("Punong Barangay", { align: "center", style: { ...cg, size: 12 } }),
      ...gap(1, 10),
      p(
        "I declare under pain of criminal prosecution that at information provided herewith are TRUE CORRECT, VALID and COMPLETE pursuant to existing laws, rules, and regulations of the Republic of the Philippines. I authorize the agency Head Authorized Representatives to verify and validate the contents stated herein. I also AGREE that any misrepresentation and information acts to defend the government may lead to the thing of appropriate cases against me and may cause disqualification to receive financial assistance from the DSWD.",
        { align: "justify", after: 28, style: { ...cg, size: 10, i: true } }
      ),
      p([v("resident_name", { ...cg, size: 10, b: true, u: true, caps: true })], { align: "center", left: 200 }),
      p("Name and signature of the client", { align: "center", left: 200, style: { ...cg, size: 10 } }),
    ]),
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// Certification 101 — split into three individual templates, one per
// certificate (Barangay Certification, Residency, Indigency).
// ─────────────────────────────────────────────────────────────────────────

const cert101Width = 541;
const cert101Tnr = (o: Style = {}): Style => ({ font: "Times New Roman", ...o });
const cert101Bookman = (o: Style = {}): Style => ({ font: "Bookman Old Style", ...o });

const cert101OfficeLines = (color: string, size: number, tnrFont: boolean): TiptapNode[] => {
  const s: Style = tnrFont ? cert101Tnr({ size, b: true, color }) : { size, color };
  return [
    p("Republic of the Philippines", { align: "center", style: s }),
    p("Province of La Union", { align: "center", style: s }),
    p("MUNICIPALITY OF ROSARIO", { align: "center", style: s }),
    p("Barangay Rabon", { align: "center", style: s }),
    p("Office of the Punong Barangay", { align: "center", style: tnrFont ? s : { size: 16, i: true, color } }),
  ];
};

const CERT101_G3 = "#3A3A3A";
const CERT101_G4 = "#404040";

const cert101Page: SeedTemplate["page"] = {
  size: "Letter",
  margins: { top: 37, right: 28, bottom: 28, left: 43 },
  watermark: { src: `${ASSET}/8dd33b.jpeg`, opacity: 0.1 },
};

// 1 ─ Barangay Certification with council roster
const certification101BarangayCertification: SeedTemplate = (() => {
  const width = cert101Width;
  const tnr = cert101Tnr;
  const bookman = cert101Bookman;

  // Council roster (left) beside the barangay certification (right).
  const roster: TiptapNode[] = [
    p([v("punong_barangay", bookman({ size: 12, b: true, u: true, caps: true }))], { align: "center" }),
    p("Punong Barangay", { align: "center", after: 10 }),
    p("SANGGUNIANG BARANGAY", { align: "center", style: bookman({ b: true }) }),
    p("MEMBER", { align: "center", after: 4, style: bookman({ b: true }) }),
    ...[1, 2, 3, 4, 5, 6, 7].map((n) => p([v(`kagawad_${n}`, bookman())], { align: "center", after: 2 })),
    p([v("sk_chairperson", { b: true, caps: true })], { align: "center", before: 10 }),
    p("SK Chairperson", { align: "center" }),
    p([v("barangay_treasurer", { b: true, caps: true })], { align: "center", before: 8 }),
    p("Barangay Treasurer", { align: "center" }),
    p([v("barangay_secretary", { b: true, caps: true })], { align: "center", before: 8 }),
    p("Barangay Secretary", { align: "center", after: 24 }),
    p(["RES.CERT.NO. ", v("document_number")]),
    p(["ISSUED ON: ", v("issue_date")]),
    p("ISSUED AT: Barangay Rabon"),
  ];

  const certBody: TiptapNode[] = [
    p("BARANGAY CERTIFICATION", { align: "center", after: 14, style: tnr({ size: 14, b: true, color: "#0D0D0D" }) }),
    p("TO WHOM IT MAY CONCERN:", { align: "justify", after: 12, style: tnr({ size: 12, b: true }) }),
    p(
      [
        "This is to certify that ", v("resident_name", tnr()), " legal age, ", v("civil_status", tnr()),
        " is a resident of this barangay. And is personally known to me be a person of Good Moral Character and Integrity, She / He is a law abiding Citizen.",
      ],
      { align: "justify", indent: 36, after: 12, style: tnr() }
    ),
    p(
      "It is further certified that there is no information that the subject person is a member of any organization and or association that is subversive in nature or one that seeks to overthrow the duly constituted Government of the Philippines.",
      { align: "justify", indent: 36, after: 12, style: tnr() }
    ),
    p("This certification is issued upon the request of the herein person for legal intents and purposes.", {
      align: "justify",
      indent: 36,
      after: 12,
      style: tnr(),
    }),
    p(DATE_LINE("Issued this", "at Barangay Rabon, Rosario, La Union.").map((n) => (typeof n === "string" ? t(n, tnr()) : n)), {
      align: "justify",
      indent: 36,
      after: 24,
    }),
    table(
      [
        [
          { content: [p("Prepared by:", { style: { i: true } }), p([v("barangay_secretary", { size: 10, b: true, u: true, caps: true })], { before: 14 }), p("Barangay Secretary", { style: { size: 10 } })], width: px(180) },
          { content: [p("Certified by:", { style: { i: true } }), p([v("punong_barangay", { size: 10, b: true, u: true, caps: true })], { before: 14 }), p("Punong Barangay", { style: { size: 10 } })], width: px(180) },
        ],
      ],
      { borders: "none" }
    ),
  ];

  return {
    slug: "certification-101-barangay-certification",
    name: "Barangay Certification",
    documentType: "barangayCertification",
    originalFilename: "certification-101-barangay-certification.docx",
    page: cert101Page,
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 80,
        rightWidth: 90,
        left: [img("6cf151.jpeg", 51, "Seal of the Municipality of Rosario")],
        right: [img("258a45.png", 62, "Bagong Pilipinas")],
        lines: [
          p("Republic of the Philippines", { align: "center", style: { size: 16 } }),
          p("Province of La Union", { align: "center", style: { size: 16 } }),
          p("Municipality of Rosario", { align: "center", style: { size: 16 } }),
          p("Barangay Rabon", { align: "center", style: { size: 18 } }),
          p("Office of the Punong Barangay", { align: "center", style: tnr({ size: 18, i: true }) }),
        ],
      }),
      rule(),
      table([[{ content: roster, width: px(170) }, { content: certBody, width: px(371) }]], { borders: "none" }),
    ]),
  };
})();

// 2 ─ Barangay Certificate of Residency
const certification101Residency: SeedTemplate = (() => {
  const width = cert101Width;
  const tnr = cert101Tnr;
  const G3 = CERT101_G3;
  return {
    slug: "certification-101-residency",
    name: "Barangay Certificate of Residency",
    documentType: "certificateOfResidency",
    originalFilename: "certification-101-residency.docx",
    page: cert101Page,
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 90,
        rightWidth: 90,
        left: [img("2b39a1.jpeg", 66, "Seal of the Municipality of Rosario")],
        right: [img("ac6ab4.png", 72, "Bagong Pilipinas")],
        lines: cert101OfficeLines(G3, 12, true),
      }),
      rule(),
      ...gap(1, 6),
      p("BARANGAY CERTIFICATE OF RESIDENCY", { align: "center", after: 20, style: tnr({ size: 18, b: true, color: G3 }) }),
      p("TO WHOM IT MAY CONCERN:", { align: "justify", after: 14, style: tnr({ size: 14, b: true, color: G3 }) }),
      p(
        [
          "This is to certify that ", v("resident_name", tnr({ size: 14, color: G3 })), " of legal age, ", v("civil_status", tnr({ size: 14, color: G3 })),
          ", Filipino Citizen, and a bonafide resident herein ", v("purok", tnr({ size: 14, color: G3 })), ", Barangay Rabon, Rosario, La Union",
        ],
        { align: "justify", indent: 36, after: 14, style: tnr({ size: 14, color: G3 }) }
      ),
      p("This certification is issued upon request of the said herein person for whatever legal intents and purposes it may serve.", {
        align: "justify",
        indent: 36,
        after: 14,
        style: tnr({ size: 14, color: G3 }),
      }),
      p(DATE_LINE("Issued this", "at Barangay Rabon, Rosario, La Union.").map((n) => (typeof n === "string" ? t(n, tnr({ size: 14, color: G3 })) : n)), {
        align: "justify",
        indent: 36,
        after: 40,
      }),
      p("Certified by:", { align: "center", left: 260, style: tnr({ size: 14, color: G3 }) }),
      p([t("HON. ", tnr({ size: 14, u: true, color: G3 })), v("punong_barangay", tnr({ size: 14, u: true, color: G3, caps: true }))], { align: "center", left: 260, before: 14 }),
      p("Barangay Captain", { align: "center", left: 260, style: tnr({ size: 14, color: G3 }) }),
    ]),
  };
})();

// 3 ─ Certificate of Indigency
const certification101Indigency: SeedTemplate = (() => {
  const width = cert101Width;
  const G4 = CERT101_G4;
  return {
    slug: "certification-101-indigency",
    name: "Certificate of Indigency",
    originalFilename: "certification-101-indigency.docx",
    page: cert101Page,
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 90,
        rightWidth: 90,
        left: [img("33a295.png", 79, "Seal of the Municipality of Rosario")],
        right: [img("3f45b0.jpeg", 65, "Barangay Rabon seal")],
        lines: cert101OfficeLines(CERT101_G4, 12, false),
      }),
      rule(),
      ...gap(1, 6),
      ...indigencyBlocks(
        {
          title: { font: "Britannic Bold", size: 18, b: true, color: G4 },
          greeting: { size: 16, b: true, color: G4 },
          body: { size: 14, color: G4 },
          sig: { size: 14, color: G4 },
          gapAfter: 17,
        },
        250
      ),
    ]),
  };
})();

// ─────────────────────────────────────────────────────────────────────────
// First-Time Jobseeker — split into two individual templates
// (Barangay Certification, Oath of Undertaking).
// ─────────────────────────────────────────────────────────────────────────

const jobseekerWidth = 540;
const jobseekerAn: Style = { font: "Arial Narrow", size: 12 };
const jobseekerBk = (b: boolean): Style => ({ font: "Bookman Old Style", size: 10, b });

const jobseekerOffice = (): TiptapNode[] => {
  const s: Style = { font: "Times New Roman", size: 12, b: true };
  return [
    p(
      [img("4577f2.png", 54, "Seal of the Municipality of Rosario"), "      ", img("c27702.png", 57, "Bagong Pilipinas"), "      ", img("3c31c8.jpeg", 48, "Barangay Rabon seal")],
      { align: "center", after: 6 }
    ),
    p("Republic of the Philippines", { align: "center", style: s }),
    p("Province of La Union", { align: "center", style: s }),
    p("MUNICIPALITY OF ROSARIO", { align: "center", style: s }),
    p("Barangay Rabon", { align: "center", style: s }),
    p("OFFICE OF PUNONG BARANGAY", { align: "center", style: { ...s, i: true } }),
    rule(),
  ];
};

const jobseekerUndertakings: [string, boolean][] = [
  ["That this is the first time that actively look for job, and therefore requesting that a Barangay Certification be issued in my favor the benefits off the law;", true],
  ["That I am Aware that the benefit and privileges/s under the said law shall be valid only for one year from the  date that the Barangay Certification issued;", true],
  ["That I  can avail the benefits of the law only once;", true],
  ["That I understand that my personal information that shall be included in the Rooster/ List of First Time Jobseekers and will not be used  for any unlawful purpose;", true],
  ["That I will inform and / or report to the Barangay personally, through text or other means, or through my family/relatives once I get employed ; and", true],
  ["Thar I am not a beneficiary of the Job Start Program under R.A. No.10869 and other laws that give similar exemption for the documents or transactions exempted under R.A No. 11261;", true],
  ["That if issued the requested certification , I will not use the same in any fraud, neither falsity nor help and/or assist in the fabrication of the said certification", true],
  ["That this undertaking is made society for the purpose of obtaining A Barangay Certification consistent with the objective of R.A 11261 and not for any other purposes.", false],
  ["THAT I consent to the use of my personal information pursuant to the data privacy  and other applicable laws ,rules, ad regulations.", false],
];

const jobseekerPage: SeedTemplate["page"] = { size: "Legal", margins: { top: 36, right: 36, bottom: 36, left: 36 } };

// 1 ─ Barangay Certification (RA 11261)
const firstTimeJobseekerCertification: SeedTemplate = {
  slug: "first-time-jobseeker-certification",
  name: "First-Time Jobseeker Certification",
  documentType: "certificateOfFirstTimeJobseeker",
  originalFilename: "certification-of-first-time-jobseeker-certification.docx",
  page: jobseekerPage,
  editorContent: doc([
    ...jobseekerOffice(),
    ...gap(1, 4),
    p("BARANGAY CERTIFICATION", { align: "center", style: { font: "Engravers MT", size: 14, b: true } }),
    p("(First Time Jobseekers Assistance Act – RA 11261)", { align: "center", after: 14, style: { size: 12 } }),
    p(
      [
        "THIS IS TO CERTIFY THAT: ", v("resident_name", { ...jobseekerAn, b: true }),
        " a resident of Barangay Rabon, Rosario, La Union for ", v("age", { ...jobseekerAn, b: true }),
        " years old, is a qualified of RA 11261 or the First Time Jobseekers Act of 2019.",
      ].map((n) => (typeof n === "string" ? t(n, { ...jobseekerAn, b: true }) : n)),
      { align: "justify", indent: 36, after: 14 }
    ),
    p(
      "I further certify that the holder/bearer was informed of his/her rights, including duties and responsibilities accorded by RA 11261 through the Oath of Understanding he/she has signed and executed in the presence of our Barangay officials.",
      { align: "justify", indent: 36, after: 14, style: jobseekerAn }
    ),
    p(DATE_LINE("Signed this", "in Barangay Rabon, Rosario, La Union.").map((n) => (typeof n === "string" ? t(n, jobseekerAn) : n)), {
      align: "justify",
      indent: 36,
      after: 14,
    }),
    p("This certification is valid only for one (1) year from the issuance.", { align: "justify", indent: 36, after: 28, style: jobseekerAn }),
    p("Certified by:", { align: "center", after: 14, style: jobseekerAn }),
    p([t("HON. ", { size: 12, b: true, caps: true }), v("punong_barangay", { size: 12, b: true, caps: true })], { align: "center" }),
    p("Barangay Captain", { align: "center", after: 24, style: { size: 12, b: true } }),
    p("Witnessed by:", { align: "center", after: 14, style: { font: "Arial Narrow" } }),
    p([v("barangay_secretary", { font: "Bodoni MT", b: true, caps: true })], { align: "center" }),
    p("Barangay Secretary", { align: "center", style: { size: 10 } }),
  ]),
};

// 2 ─ Oath of Undertaking
const firstTimeJobseekerOath: SeedTemplate = {
  slug: "first-time-jobseeker-oath",
  name: "Oath of Undertaking (First-Time Jobseeker)",
  documentType: "firstTimeJobseekerOath",
  originalFilename: "certification-of-first-time-jobseeker-oath.docx",
  page: jobseekerPage,
  editorContent: doc([
    ...jobseekerOffice(),
    ...gap(1, 4),
    p("OATH OF UNDERTAKING", { align: "center", after: 14, style: { size: 16 } }),
    p(
      [
        "I ", v("resident_name", jobseekerBk(false)), " ", v("age", jobseekerBk(false)),
        " yrs. of age , a  resident of RABON ROSARIO LA UNION, availing the benefits of Republic act 111261, otherwise known as the first time jobseekers Act of 2019, do hereby declare, agree and undertake  to abide and be bound by the following:",
      ].map((n) => (typeof n === "string" ? t(n, jobseekerBk(false)) : n)),
      { align: "justify", after: 10 }
    ),
    numbered(jobseekerUndertakings.map(([text, bold]) => [p(text, { align: "justify", after: 8, style: jobseekerBk(bold) })])),
    p(DATE_LINE("Signed this", "in Barangay Rabon Rosario LA union.").map((n) => (typeof n === "string" ? t(n, { size: 10 }) : n)), {
      align: "justify",
      left: 36,
      before: 8,
      after: 28,
    }),
    p([v("resident_name", { size: 10, b: true, caps: true })], { left: 36 }),
    p("First Time Jobseeker", { left: 36, after: 20, style: { size: 10, i: true } }),
    p("Certified by:", { align: "center", after: 12, style: { font: "Arial Narrow", size: 10 } }),
    p([t("HON. ", { size: 10, b: true, caps: true }), v("punong_barangay", { size: 10, b: true, caps: true })], { align: "center" }),
    p("Barangay Captain", { align: "center", style: { size: 10, b: true } }),
  ]),
};

export const SEED_TEMPLATES: SeedTemplate[] = [
  indigency,
  attestation,
  treesCutting,
  certification101BarangayCertification,
  certification101Residency,
  certification101Indigency,
  firstTimeJobseekerCertification,
  firstTimeJobseekerOath,
  endorsementForScholarLowIncome,
  endorsementForScholarIndigency,
  endorsementForScholarLetter,
];
