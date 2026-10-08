/**
 * Default document template definitions. These mirror the barangay's actual
 * certificate designs (text, purpose, fees). Each seeded default is a rich
 * Tiptap document with the same official letterhead as the DOCX templates
 * (Republic header + logos), so the PDF Document Template render matches the
 * DOCX look. Templates created from these are independent, data-driven
 * documents — each can be edited on its own without affecting the others.
 *
 * Note: "Barangay Certificate" is the single consolidated document for what
 * used to be both "Barangay Certificate" and "Barangay Clearance". There is
 * NO separate clearance template.
 */
import { Style, doc, gap, img, letterhead, p, rule, t, table, v } from "./docTemplateSeed/builders";
import { legacyKeyToVariable, TEMPLATE_VARIABLE_KEYS } from "../utils/templateVariables";
import { TiptapNode } from "../utils/tiptapDoc";

export interface SeedTemplateDef {
  documentType: string;
  name: string;
  description: string;
  fee: number;
  title: string;
  body: string;
  signaturePosition: string;
  layout?: { editorContent: TiptapNode; page: SeedPage };
}

const shaded = (text: string, style: Style, fill: string): TiptapNode => {
  const node = t(text, style);
  return { ...node, marks: [...(node.marks || []), { type: "highlight", attrs: { color: fill } }] };
};

const sealDivider = (seal: TiptapNode, width: number, sealWidth: number): TiptapNode => {
  const px = (pt: number) => Math.round((pt * 4) / 3);
  const side = (width - sealWidth) / 2;
  const line = [p([], { before: 16 }), rule()];
  return table(
    [
      [
        { content: line, width: px(side) },
        { content: [p([seal], { align: "center" })], width: px(sealWidth) },
        { content: line, width: px(side) },
      ],
    ],
    { borders: "none" },
  );
};

const cohabitantLayout = (): { editorContent: TiptapNode; page: SeedPage } => {
  const width = 451;
  const head: Style = { font: "Aptos", size: 14 };
  const body: Style = { font: "Aptos", size: 11 };
  const gray: Style = { font: "Aptos Display", size: 11, color: "#3A3A3A" };
  const sig: Style = { font: "Times New Roman", size: 12, color: "#3A3A3A" };
  const name: Style = { ...body, caps: true };
  return {
    page: {
      size: "A4",
      orientation: "portrait",
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
    },
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 90,
        rightWidth: 90,
        left: [img("2b39a1.jpeg", 62, "Seal of the Municipality of Rosario")],
        right: [img("45a70c.png", 72, "Bagong Pilipinas")],
        lines: [
          p("Republic of the Philippines", { align: "center", style: head }),
          p("Province of La Union", { align: "center", style: head }),
          p("Municipality of Rosario", { align: "center", style: head }),
          p("Barangay Rabon", { align: "center", style: head }),
          p("Office of the Punong Barangay", { align: "center", style: { ...head, i: true } }),
        ],
      }),
      sealDivider(img("8dd33b.jpeg", 47, "Barangay Rabon seal"), width, 90),
      ...gap(1, 8),
      p([shaded(" CERTIFICATION OF COHABITATION ", { font: "Aptos", size: 14, color: "#FFFFFF" }, "#0C0C0C")], {
        align: "center",
        after: 8,
      }),
      ...gap(1, 8),
      p("To whom it may concern.", { align: "justify", after: 8, line: 1.08, style: body }),
      p(
        [
          "This is to certify that ", v("resident_name", name), ", born on ", v("birth_date", body),
          ", and ", v("spouse_name", name), ", born on ", v("spouse_birth_date", body),
          ", have been living as a spouses in good faith, taking on all of the tasks and responsibilities that follow with being in the relationship, cohabiting the same household at ",
          v("purok", body),
          ", Rabon, Rosario, La Union, and both holding themselves out to the community as spouses since ",
          v("cohabitation_year", body), ".",
        ],
        { align: "justify", indent: 72, after: 8, line: 1.08, style: body },
      ),
      p("This certification is issued upon request of the said herein person for whatever legal intents and purposes it may serve.", {
        align: "justify",
        indent: 72,
        style: gray,
      }),
      ...gap(1),
      p(
        ["Issued this ", v("issue_day_ordinal", { ...gray, b: true }), " day of ", v("issue_month", gray), ", ", v("issue_year", gray), " at Barangay Rabon, Rosario, La Union."],
        { align: "justify", indent: 36, style: gray },
      ),
      ...gap(3),
      p("Certified by:", { left: 180, style: sig }),
      ...gap(2),
      p([t("HON. ", { ...sig, u: true }), v("punong_barangay", { ...sig, u: true, caps: true })], { align: "center", left: 252 }),
      p("Barangay Captain", { align: "center", left: 252, style: sig }),
    ]),
  };
};

const soloLayout = (): { editorContent: TiptapNode; page: SeedPage } => {
  const width = 468;
  const head: Style = { font: "Calibri", size: 14 };
  const body: Style = { font: "Calibri Light", size: 14 };
  const para = (content: (TiptapNode | string)[]) =>
    p(content, { align: "justify", indent: 36, after: 10, line: 1.15, style: body });
  return {
    page: {
      size: "LETTER",
      orientation: "portrait",
      margins: { top: 72, right: 72, bottom: 72, left: 72 },
      background: "/assets/docx-templates/shared/59c67f.png",
    },
    editorContent: doc([
      letterhead({
        width,
        leftWidth: 90,
        rightWidth: 90,
        left: [],
        right: [img("45a70c.png", 72, "Bagong Pilipinas")],
        lines: [
          p("Republic of the Philippines", { align: "center", style: head }),
          p("Province of La Union", { align: "center", style: head }),
          p("Municipality of Rosario", { align: "center", style: head }),
          p([shaded(" Barangay Rabon ", { ...head, color: "#FFFFFF" }, "#000000")], { align: "center" }),
          p("Office of the Punong Barangay", { align: "center", style: { ...head, i: true } }),
        ],
      }),
      sealDivider(img("c029f7.jpeg", 64, "Barangay Rabon seal"), width, 90),
      ...gap(1, 10),
      p("CERTIFICATION", { align: "center", after: 10, style: { font: "Arial Rounded MT Bold", size: 18, b: true } }),
      p("To Whom It May Concern;", { align: "justify", after: 10, style: { font: "Calibri", size: 14, b: true } }),
      para([
        "This is to certify that as per record available in this office ",
        v("resident_name", { ...body, b: true, u: true, caps: true }), ", ", v("age", body),
        " years old, Filipino Citizen, and a bonafide resident here in Barangay Rabon, Rosario, La Union.",
      ]),
      para(["Further certify that above named person \u201Csolo parent\u201D having sole custody care and support of his/her child."]),
      para(["This certification is issued upon request of the above mentioned for whatever legal purposes it may serve."]),
      para(["Issued this ", v("issue_day_ordinal", body), " day of ", v("issue_month", body), ", ", v("issue_year", body), " At Barangay Rabon, Rosario, La Union."]),
      ...gap(1, 10),
      p("Certified by:", { left: 252, after: 24, style: body }),
      p([v("punong_barangay", { ...body, b: true, u: true, caps: true })], { align: "center", left: 252 }),
      p("Punong Barangay", { align: "center", left: 252, style: body }),
    ]),
  };
};

export const seedTemplateDefinitions: SeedTemplateDef[] = [
  {
    documentType: "barangayCertificate",
    name: "Barangay Certificate",
    description: "Official certification of your residency.",
    fee: 30,
    title: "Barangay Certification",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}}, of legal age, {{resident.civilStatus}}, is a resident of this barangay.\n\n" +
      "This certification is issued upon the request of the herein person for legal intents and purposes.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
  },
  {
    documentType: "certificateOfGoodMoralCharacter",
    name: "Certificate of Good Moral Character",
    description: "Certification of your good moral character and integrity.",
    fee: 30,
    title: "Certificate of Good Moral Character",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}}, of legal age, {{resident.civilStatus}}, is a resident of this barangay, and is personally known to me to be a person of Good Moral Character and Integrity. He / She is a law abiding citizen.\n\n" +
      "It is further certified that there is no information that the subject person is a member of any organization and or association that is subversive in nature or one that seeks to overthrow the duly constituted Government of the Philippines.\n\n" +
      "This certification is issued upon the request of the herein person for legal intents and purposes.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
  },
  {
    documentType: "certificateOfResidency",
    name: "Certificate of Residency",
    description: "Proof that you are a bonafide resident of this barangay.",
    fee: 35,
    title: "Barangay Certificate of Residency",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}} of legal age, {{resident.civilStatus}}, Filipino citizen, and a bonafide resident herein Purok {{resident.purok}}, {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.\n\n" +
      "This certification is issued upon request of the said herein person for whatever legal intents and purposes it may serve.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
  },
  {
    documentType: "certificateOfIndigency",
    name: "Certificate of Indigency",
    description: "Documentation for financial or medical assistance.",
    fee: 30,
    title: "Certificate of Indigency",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}} as per records available in this office, a bonafide resident of this Barangay.\n\n" +
      "Further said person belongs to an indigent family and has no stable source of income.\n\n" +
      "Any help or assistance to {{resident.assistanceTo}} by the duly constituted authorities is greatly appreciated.\n\n" +
      "Given this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}, for all legal intents and purposes it may serve.",
  },
  {
    documentType: "barangayBusinessClearance",
    name: "Barangay Business Clearance",
    description: "Permit for operating a business in the barangay.",
    fee: 80,
    title: "Barangay Business Clearance",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}}, proprietor of {{resident.businessName}}, a {{resident.businessType}} business located at {{resident.businessAddress}}, engaged in {{resident.businessNature}}, has met all Barangay requirements and is authorized to operate within the jurisdiction of this Barangay.\n\n" +
      "This clearance is issued upon the request of the above-named person for the operation, registration and licensing of the said business and for whatever legal purpose it may serve.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
  },
  {
    documentType: "certificateOfAttestation",
    name: "Certificate of Attestation",
    description: "Attestation of income and household expenses.",
    fee: 30,
    title: "Certificate of Attestation",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that Mr./Mrs. {{resident.fullName}} residing at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}, {{resident.workStatus}} at {{resident.workplace}}, earning a monthly income of {{resident.monthlyIncome}}.\n\n" +
      "Following a thorough assessment and validation of the client's socio-economic profile conducted by the undersigned Barangay Council, it has been determined that {{resident.fullName}} is an individual receiving income below the regional minimum wage and is facing significant financial challenges because of the effects of inflation.\n\n" +
      "This certification is issued upon the request of the above-mentioned person for whatever legal purpose/s it may serve.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
  },
  {
    documentType: "certificationOfTreesCutting",
    name: "Certification of Trees Cutting",
    description: "Certification for cutting trees on your land.",
    fee: 50,
    title: "Certification of Trees Cutting",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}} has cut trees within an area of {{resident.landArea}} square meters, consisting of {{resident.treeCount}} tree(s) of {{resident.treeType}}, situated in this Barangay, and that the cutting was legally registered and processed with the proper authorities.\n\n" +
      "This certification is issued to attest the legality of the tree cutting activities performed by the above-named person for all legal intents and purposes it may serve.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
  },
  {
    documentType: "barangayCertification",
    name: "Barangay Certification",
    description: "Official certification of your personal details.",
    fee: 30,
    title: "Barangay Certification",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}} legal age, {{resident.civilStatus}} is a resident of this barangay, and is personally known to me to be a person of Good Moral Character and Integrity. He / She is a law abiding citizen.\n\n" +
      "It is further certified that there is no information that the subject person is a member of any organization and or association that is subversive in nature.\n\n" +
      "This certification is issued upon the request of the herein person for legal intents and purposes.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
  },
  {
    documentType: "certificateOfFirstTimeJobseeker",
    name: "Barangay Certification (First-Time Jobseeker)",
    description: "RA 11261 certificate for first-time jobseekers.",
    fee: 0,
    title: "Barangay Certification (First Time Jobseekers Assistance Act - RA 11261)",
    signaturePosition: "Punong Barangay",
    body:
      "THIS IS TO CERTIFY THAT: {{resident.fullName}} a resident of {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}} for {{resident.age}} years old, is a qualified of RA 11261 or the First Time Jobseekers Act of 2019.\n\n" +
      "I further certify that the holder/bearer was informed of his/her rights, including duties and responsibilities accorded by RA 11261 through the Oath of Undertaking he/she has signed and executed in the presence of our Barangay officials.\n\n" +
      "Signed this {{certificate.date}} in {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.\n\n" +
      "This certification is valid only for one (1) year from the issuance.",
  },
  {
    documentType: "firstTimeJobseekerOath",
    name: "Oath of Undertaking (First-Time Jobseeker)",
    description: "Oath of Undertaking signed under RA 11261.",
    fee: 0,
    title: "Oath of Undertaking (First-Time Jobseeker)",
    signaturePosition: "Punong Barangay",
    body:
      "I, {{resident.fullName}}, {{resident.age}} yrs. old, a resident of {{resident.address}}, do hereby swear that I am a first-time jobseeker and that the information I have provided are TRUE, CORRECT, VALID and COMPLETE.\n\n" +
      "I understand the rights, duties and responsibilities accorded to me under RA 11261 or the First Time Jobseekers Assistance Act of 2019.\n\n" +
      "Signed this {{certificate.date}}.",
  },
  {
    documentType: "certificateOfLowIncome",
    name: "Certificate of Low Income",
    description: "Certification of low income for assistance.",
    fee: 30,
    title: "Certificate of Low Income",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}} and {{resident.spouseName}}, married and a resident of this barangay, belong to indigent families with an annual income of P {{resident.annualIncome}}.\n\n" +
      "Any help or assistance to {{resident.assistanceTo}} by the duly constituted authorities is greatly appreciated.\n\n" +
      "Given this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}, for the purpose of {{resident.purpose}} or whatever legal purposes it may serve.",
  },
  {
    documentType: "endorsementLetter",
    name: "Endorsement Letter",
    description: "Endorsement letter for scholarship applicants.",
    fee: 30,
    title: "Endorsement Letter",
    signaturePosition: "Punong Barangay",
    body:
      "To the Honorable Mayor, Municipality of {{barangay.municipality}}, {{barangay.province}}.\n\n" +
      "Dear Honorable Mayor:\n\n" +
      "This is to endorse {{resident.fullName}} of Purok {{resident.purok}}, {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.\n\n" +
      "I have known this student to have a good record and good moral character.\n\n" +
      "Furthermore, I hereby endorse the said person to your good office for {{resident.purpose}} as one of your scholars.\n\n" +
      "Given this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}, for all legal intents and purposes it may serve.",
  },
  {
    documentType: "certificationOfCohabitant",
    name: "Certification of Cohabitant",
    description: "Certification that two residents live together as spouses.",
    fee: 30,
    title: "Certification of Cohabitation",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}}, born on {{resident.birthDate}}, and {{resident.spouseName}}, born on {{resident.spouseBirthDate}}, have been living as spouses, cohabiting the same household at {{resident.purok}}, {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}} since {{resident.cohabitationYear}}.\n\n" +
      "This certification is issued upon request of the said herein person for whatever legal intents and purposes it may serve.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
    layout: cohabitantLayout(),
  },
  {
    documentType: "soloCertification",
    name: "Solo Certification",
    description: "Certification of a solo parent with sole custody of a child.",
    fee: 30,
    title: "Certification",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that as per record available in this office {{resident.fullName}}, {{resident.age}} years old, Filipino Citizen, and a bonafide resident here in {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.\n\n" +
      "Further certify that above named person \u201Csolo parent\u201D having sole custody care and support of his/her child.\n\n" +
      "This certification is issued upon request of the above mentioned for whatever legal purposes it may serve.\n\n" +
      "Issued this {{certificate.date}} at {{barangay.name}}, {{barangay.municipality}}, {{barangay.province}}.",
    layout: soloLayout(),
  },
];

// ── Rich Tiptap generator ───────────────────────────────────────────────
// Builds each seeded default as a Tiptap document with the same official
// letterhead as the DOCX templates, so the PDF render (renderTiptapDocument)
// looks like the DOCX instead of the old plain "elements" layout.

const G = "#404040";
const bookman14 = (extra: Style = {}): Style => ({ font: "Bookman Old Style", size: 14, ...extra });

const LETTERHEAD_WIDTH = 432; // Letter 612pt - 90pt - 90pt margins
const BODY_STYLE: Style = { size: 14, color: G };

/** Names legacy {{resident.fullName}} etc. → registered variable keys. */
function placeholderRuns(text: string, style: Style): (TiptapNode | string)[] {
  const out: (TiptapNode | string)[] = [];
  const pattern = /\{\{([a-zA-Z0-9_. ]+)\}\}|\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if ((match.index ?? 0) > last) out.push(text.slice(last, match.index));
    last = (match.index ?? 0) + match[0].length;
    const raw = (match[1] ?? match[2]).trim();
    const key = TEMPLATE_VARIABLE_KEYS.has(raw)
      ? raw
      : legacyKeyToVariable(raw) ??
        legacyKeyToVariable(`resident.${raw}`) ??
        legacyKeyToVariable(`certificate.${raw}`);
    out.push(key ? v(key, style) : match[0]);
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function bodyParagraphs(body: string): TiptapNode[] {
  return body
    .split(/\n+/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) =>
      p(placeholderRuns(para, BODY_STYLE), {
        align: "justify",
        indent: 36,
        after: 17,
        style: BODY_STYLE,
      }),
    );
}

export interface SeedPage {
  size: "A4" | "LETTER";
  orientation: "portrait";
  margins: { top: number; right: number; bottom: number; left: number };
  background?: string;
}

/** Rich Tiptap editor content + page setup for a seeded default template. */
export function buildSeedEditorContent(def: Pick<SeedTemplateDef, "title" | "body" | "layout">): {
  editorContent: TiptapNode;
  page: SeedPage;
} {
  if (def.layout) return def.layout;
  const editorContent = doc([
    letterhead({
      width: LETTERHEAD_WIDTH,
      leftWidth: 84,
      rightWidth: 132,
      left: [
        img("2b39a1.jpeg", 60, "Seal of the Municipality of Rosario"),
      ],
      right: [
        img("1bf6ef.png", 62, "Bagong Pilipinas"),
        img("8dd33b.jpeg", 47, "Barangay Rabon seal"),
      ],
      lines: [
        p("Republic of the Philippines", { align: "center", style: bookman14() }),
        p("Province of La Union", { align: "center", style: bookman14() }),
        p("Municipality of Rosario", { align: "center", style: bookman14() }),
        p("Barangay Rabon", { align: "center", style: bookman14() }),
        p("Office of the Punong Barangay", {
          align: "center",
          style: { size: 16, i: true, color: G },
        }),
      ],
    }),
    rule(),
    ...gap(2),
    p(def.title.toUpperCase(), {
      align: "center",
      after: 17,
      style: { font: "Britannic Bold", size: 18, b: true, color: G },
    }),
    ...bodyParagraphs(def.body),
    ...gap(3),
    p("Certified by:", {
      align: "center",
      left: 216,
      style: { size: 14, b: true, color: G },
    }),
    p(
      [t("Hon. ", { size: 14, b: true, u: true, color: G }), v("punong_barangay", { size: 14, b: true, u: true, color: G })],
      { align: "center", left: 216 },
    ),
    p("Punong Barangay", { align: "center", left: 216, style: { size: 14, color: G } }),
  ]);

  return {
    editorContent,
    page: {
      size: "LETTER",
      orientation: "portrait",
      margins: { top: 72, right: 90, bottom: 72, left: 90 },
    },
  };
}

export default seedTemplateDefinitions;