/**
 * Default document template definitions. These mirror the barangay's actual
 * certificate designs (text, purpose, fees) as stored in documentLayouts.ts.
 * Templates created from these are independent, data-driven documents —
 * each can be edited on its own without affecting the others.
 *
 * Note: "Barangay Certificate" is the single consolidated document for what
 * used to be both "Barangay Certificate" and "Barangay Clearance". There is
 * NO separate clearance template.
 */
export interface SeedTemplateDef {
  documentType: string;
  name: string;
  description: string;
  fee: number;
  title: string;
  body: string;
  signaturePosition: string;
}

export const seedTemplateDefinitions: SeedTemplateDef[] = [
  {
    documentType: "barangayCertificate",
    name: "Barangay Certificate",
    description: "Official certification of your residency and good moral character.",
    fee: 30,
    title: "Barangay Certification",
    signaturePosition: "Punong Barangay",
    body:
      "This is to certify that {{resident.fullName}} legal age, {{resident.civilStatus}} is a resident of this barangay, and is personally known to me to be a person of Good Moral Character and Integrity. He / She is a law abiding citizen.\n\n" +
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
];

export default seedTemplateDefinitions;