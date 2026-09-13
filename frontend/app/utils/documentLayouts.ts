/**
 * A single layout definition shared across all document types.
 * The body text, titles and fields mirror the actual official templates
 * kept in `document/` (the barangay's reference certificates).
 */

export interface DocumentLayoutField {
  /** Key in the documentRequest interface */
  key: string;
  /** Human-readable label shown on the document */
  label: string;
  /** Optional: format the value differently */
  format?: "date" | "currency" | "plain" | "number";
}

export interface DocumentLayout {
  document: string;
  price: number;
  /** Title appearing at the top of the document */
  title: string;
  /** Short description that follows the title */
  description: string;
  /** Body paragraph template. Use {fieldKey} placeholders to insert values. */
  body: string;
  /** Fields to collect/display on this document */
  fields: DocumentLayoutField[];
  /** Optional: additional narrative blocks after the main body */
  sections?: { heading?: string; text: string }[];
  /** Reference file in `document/` this layout was taken from (informational). */
  source?: string;
  /** Caption below the primary signatory (defaults to "Punong Barangay"). */
  signatoryTitle?: string;
  /** Prefix drawn in front of the signatory's name (e.g. "HON."). */
  signatoryPrefix?: string;
  /** Position of the official that also signs this document (e.g. "Barangay Secretary"). */
  preparedByPosition?: string;
}

/**
 * Backward-compatible shape matching the old `documentTypes` array
 * so existing consumers (resident/documentRequest, paymentModal, etc.)
 * continue to work without changes.
 */
export interface DocumentTypeEntry {
  document: string;
  price: number;
  /** Array of field key strings — same as the old `fields: string[]` */
  fields: string[];
}

/**
 * Dynamic document layout definitions. Content mirrors the official
 * barangay templates found in the `document/` folder.
 */
export const documentLayouts: DocumentLayout[] = [
  {
    document: "barangayCertificate",
    price: 30,
    title: "Barangay Certification",
    source: "document/Barangay Certificate (1).pdf",
    signatoryPrefix: "HON.",
    preparedByPosition: "Barangay Secretary",
    description:
      "This is to certify that the person named herein is a bonafide resident of this Barangay.",
    body:
      "This is to certify that {fullName} legal age, {civilStatus} is a resident of this barangay, and is personally known to me to be a person of Good Moral Character and Integrity. He / She is a law abiding citizen.\n\n" +
      "It is further certified that there is no information that the subject person is a member of any organization and or association that is subversive in nature or one that seeks to overthrow the duly constituted Government of the Philippines.\n\n" +
      "This certification is issued upon the request of the herein person for legal intents and purposes.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "civilStatus", label: "Civil Status" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "certificateOfResidency",
    price: 35,
    title: "Barangay Certificate of Residency",
    source: "document/CERT.docx",
    signatoryPrefix: "HON.",
    signatoryTitle: "Barangay Captain",
    description:
      "This is to certify that the person named herein is a bonafide resident of this Barangay.",
    body:
      "This is to certify that {fullName} of legal age, {civilStatus}, Filipino citizen, and a bonafide resident herein Purok {purok}, Barangay Rabon, Rosario, La Union.\n\n" +
      "This certification is issued upon request of the said herein person for whatever legal intents and purposes it may serve.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "civilStatus", label: "Civil Status" },
      { key: "purok", label: "Purok" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "certificateOfIndigency",
    price: 30,
    title: "Certificate of Indigency",
    source: "document/Certificate of Indigency.pdf",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the person named herein is considered an indigent member of this Barangay.",
    body:
      "This is to certify that {fullName} as per records available in this office, a bonafide resident of this Barangay.\n\n" +
      "Further said person belongs to an indigent family and has no stable source of income.\n\n" +
      "Any help or assistance to {assistanceTo} by the duly constituted authorities is greatly appreciated.\n\n" +
      "Given this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union, for all legal intents and purposes it may serve.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "assistanceTo", label: "Assistance To" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "barangayClearance",
    price: 40,
    title: "Barangay Clearance",
    source: "document/Barangay Clearance.pdf",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the person named herein has no derogatory or criminal record filed against him/her in this Barangay.",
    body:
      "This is to certify that {fullName}, of legal status {civilStatus}, born on {dateOfBirth}, and a resident of {address} for {yrsOfResidency} year(s), is known to this office to be of good moral character and standing in the community.\n\n" +
      "This clearance is issued upon the request of the above-named person for the purpose of {purpose} and for whatever legal purpose it may serve.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "civilStatus", label: "Civil Status" },
      { key: "dateOfBirth", label: "Date of Birth", format: "date" },
      { key: "address", label: "Address" },
      { key: "yrsOfResidency", label: "Years of Residency", format: "number" },
      { key: "purpose", label: "Purpose" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "certificateOfGoodMoralCharacter",
    price: 60,
    title: "Certificate of Good Moral Character",
    source: "",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the person named herein has demonstrated good moral character in this Barangay.",
    body:
      "This is to certify that {fullName}, a resident of {address}, is personally known to this office to be a person of good moral character, conduct and integrity, and has no derogatory record filed against him/her in this Barangay.\n\n" +
      "This certification is issued upon request of the above-named person for {purpose} and for whatever legal purpose it may serve.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "address", label: "Address" },
      { key: "purpose", label: "Purpose" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "certificateOfUnemployment",
    price: 45,
    title: "Certificate of Unemployment",
    source: "document/Certificate of Unemployment.pdf",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the person named herein is currently unemployed.",
    body:
      "This is to certify that {fullName}, born on {dateOfBirth}, a resident of {address}, is currently unemployed and is actively looking for employment, job opportunities and livelihood.\n\n" +
      "This certification is issued upon the request of the above-named person for {purpose} and for whatever legal purpose it may serve.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "dateOfBirth", label: "Date of Birth", format: "date" },
      { key: "address", label: "Address" },
      { key: "purpose", label: "Purpose" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "barangayBusinessClearance",
    price: 80,
    title: "Barangay Business Clearance",
    source: "",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the business named herein is approved to operate within this Barangay.",
    body:
      "This is to certify that {fullName}, proprietor of {businessName}, a {businessType} business located at {businessAddress}, engaged in {businessNature}, has met all Barangay requirements and is authorized to operate within the jurisdiction of this Barangay.\n\n" +
      "This clearance is issued upon the request of the above-named person for the operation, registration and licensing of the said business and for whatever legal purpose it may serve.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "businessName", label: "Business Name" },
      { key: "businessAddress", label: "Business Address" },
      { key: "businessType", label: "Business Type" },
      { key: "businessNature", label: "Nature of Business" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "certificateOfAttestation",
    price: 30,
    title: "Certificate of Attestation",
    source: "document/attestation (2).docx",
    signatoryPrefix: "HON.",
    description:
      "This is to attest that the information provided by the person named herein is true and correct.",
    body:
      "This is to certify that Mr./Mrs. {fullName} residing at Barangay Rabon, Rosario, La Union, {workStatus} at {workplace}, earning a monthly income of {monthlyIncome}.\n\n" +
      "Following a thorough assessment and validation of the client's socio-economic profile conducted by the undersigned Barangay Council, it has been determined that {fullName} is an individual receiving income below the regional minimum wage and is facing significant financial challenges because of the effects of inflation, like the rising prices of goods and services. The above-mentioned income remains insufficient to meet the unforeseen expenses {expenseType}, on top of the family's monthly household expenses amounting to {householdExpenses}, thus further straining their limited financial resources.\n\n" +
      "This certification is issued upon the request of the above-mentioned person for whatever legal purpose/s it may serve.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "workStatus", label: "Work Status" },
      { key: "workplace", label: "Workplace / Company" },
      { key: "monthlyIncome", label: "Monthly Income", format: "currency" },
      { key: "expenseType", label: "Type of Unforeseen Expense" },
      { key: "householdExpenses", label: "Monthly Household Expenses", format: "currency" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
    sections: [
      {
        text:
          "I declare under pain of criminal prosecution that the information provided herewith are TRUE, CORRECT, VALID and COMPLETE pursuant to existing laws, rules and regulations of the Republic of the Philippines. I authorize the agency head and authorized representatives to verify and validate the contents stated herein. I also AGREE that any misrepresentation of information in order to defraud the government may lead to the filing of appropriate cases against me and may cause disqualification to receive financial assistance from the DSWD.",
      },
    ],
  },
  {
    document: "certificationOfTreesCutting",
    price: 50,
    title: "Certification of Trees Cutting",
    source: "",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the trees cut by the person named herein were legally registered and processed.",
    body:
      "This is to certify that {fullName} has cut trees within an area of {landArea} square meters, consisting of {treeCount} tree(s) of {treeType}, situated in this Barangay, and that the cutting was legally registered and processed with the proper authorities.\n\n" +
      "This certification is issued to attest the legality of the tree cutting activities performed by the above-named person for all legal intents and purposes it may serve.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "titleNo", label: "Title No." },
      { key: "taxDeclarationNo", label: "Tax Declaration No." },
      { key: "landArea", label: "Land Area (sqm)", format: "number" },
      { key: "treeCount", label: "Number of Trees", format: "number" },
      { key: "treeType", label: "Tree Type" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "barangayCertification",
    price: 30,
    title: "Barangay Certification",
    source: "document/certification-101-1.docx (page 1) / document/Barangay Certificate (1).pdf",
    signatoryPrefix: "HON.",
    preparedByPosition: "Barangay Secretary",
    description:
      "This is to certify that the person named herein is a bonafide resident of this Barangay.",
    body:
      "This is to certify that {fullName} legal age, {civilStatus} is a resident of this barangay, and is personally known to me to be a person of Good Moral Character and Integrity. He / She is a law abiding citizen.\n\n" +
      "It is further certified that there is no information that the subject person is a member of any organization and or association that is subversive in nature or one that seeks to overthrow the duly constituted Government of the Philippines.\n\n" +
      "This certification is issued upon the request of the herein person for legal intents and purposes.\n\n" +
      "Issued this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "civilStatus", label: "Civil Status" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "certificateOfFirstTimeJobseeker",
    price: 0,
    title: "Barangay Certification (First Time Jobseekers Assistance Act - RA 11261)",
    source: "document/Barangay Certification (First-Time Jobseeker).pdf",
    signatoryPrefix: "HON.",
    signatoryTitle: "Barangay Captain",
    description:
      "This is to certify that the person named herein is a first-time job seeker entitled to exemption from certain fees.",
    body:
      "THIS IS TO CERTIFY THAT: {fullName} a resident of Barangay Rabon, Rosario, La Union for {age} years old, is a qualified of RA 11261 or the First Time Jobseekers Act of 2019.\n\n" +
      "I further certify that the holder/bearer was informed of his/her rights, including duties and responsibilities accorded by RA 11261 through the Oath of Undertaking he/she has signed and executed in the presence of our Barangay officials.\n\n" +
      "Signed this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} in Barangay Rabon, Rosario, La Union.\n\n" +
      "This certification is valid only for one (1) year from the issuance.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "age", label: "Age", format: "number" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "firstTimeJobseekerOath",
    price: 0,
    title: "Oath of Undertaking (First-Time Jobseeker)",
    source: "document/Barangay Certification (First-Time Jobseeker).pdf",
    signatoryPrefix: "HON.",
    signatoryTitle: "Barangay Captain",
    description:
      "Oath of Undertaking signed by a first-time jobseeker under RA 11261.",
    body:
      "I, {fullName}, {age} yrs. old, a resident of {address}, do hereby swear that I am a first-time jobseeker and that the information I have provided are TRUE, CORRECT, VALID and COMPLETE.\n\n" +
      "I understand the rights, duties and responsibilities accorded to me under RA 11261 or the First Time Jobseekers Assistance Act of 2019.\n\n" +
      "Signed this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear}.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "age", label: "Age", format: "number" },
      { key: "address", label: "Address" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "certificateOfLowIncome",
    price: 30,
    title: "Certificate of Low Income",
    source: "document/ENDORSEMENT-FOR-SCHOLAR (2).docx",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the person named herein belongs to a low-income household.",
    body:
      "This is to certify that {fullName} and {spouseName}, married and a resident of this barangay, belong to indigent families with an annual income of P {annualIncome}.\n\n" +
      "Any help or assistance to {assistanceTo} by the duly constituted authorities is greatly appreciated.\n\n" +
      "Given this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union, for the purpose of {purpose} or whatever legal purposes it may serve.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "spouseName", label: "Spouse Name" },
      { key: "annualIncome", label: "Annual Income", format: "number" },
      { key: "assistanceTo", label: "Assistance To" },
      { key: "purpose", label: "Purpose" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
  {
    document: "endorsementLetter",
    price: 30,
    title: "Endorsement Letter",
    source: "document/ENDORSEMENT-FOR-SCHOLAR (2).docx",
    signatoryPrefix: "HON.",
    description:
      "This is to certify that the person named herein is endorsed by this Barangay.",
    body:
      "To the Honorable Mayor, Municipality of Rosario, La Union.\n\n" +
      "Dear Honorable Mayor:\n\n" +
      "This is to endorse {fullName} of Purok {purok}, Barangay Rabon, Rosario, La Union.\n\n" +
      "I have known this student to have a good record and good moral character.\n\n" +
      "Furthermore, I hereby endorse the said person to your good office for {purpose} as one of your scholars.\n\n" +
      "Given this {dateIssuedDay} day of {dateIssuedMonth}, {dateIssuedYear} at Barangay Rabon, Rosario, La Union, for all legal intents and purposes it may serve.",
    fields: [
      { key: "fullName", label: "Full Name" },
      { key: "purok", label: "Purok" },
      { key: "purpose", label: "Purpose" },
      { key: "dateIssued", label: "Date Issued", format: "date" },
    ],
  },
];

export const getDocumentLayout = (document: string): DocumentLayout | undefined =>
  documentLayouts.find((l) => l.document === document);

export const getDocumentPrice = (document: string): number =>
  getDocumentLayout(document)?.price ?? 0;

/**
 * Backward-compatible array that matches the old `documentTypes` shape.
 * Each entry exposes `fields` as a simple string[] (field keys) so that
 * existing consumers don't break.
 */
export const documentTypes: DocumentTypeEntry[] = documentLayouts.map((layout) => ({
  document: layout.document,
  price: layout.price,
  fields: layout.fields.map((f) => f.key),
}));