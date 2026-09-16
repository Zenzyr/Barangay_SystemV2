import { documentRequestInterface } from "@/app/types/documentRequest";
import { barangaySettings } from "@/app/types/barangaySettings.type";
import { formatDateParts } from "./documentFormat";

export interface DocxTemplateRenderData {
  resident: { fullName: string; gender: string; civilStatus: string; purok: string; spouseName: string; annualIncome: string; };
  certificate: { day: string; dayOrdinal: string; dayOrdinalLower: string; month: string; year: string; pronoun: string; subjectPronoun: string; singleMark: string; marriedMark: string; widowMark: string; mrMrs: string; dateShort: string; purpose: string; };
  barangay: { name: string; municipality: string; province: string; punongBarangay: string; };
  officials: { punongBarangay: string; secretary: string; treasurer: string; skChairperson: string; };
  sangguniangBarangay: { member0: string; member1: string; member2: string; member3: string; member4: string; member5: string; member6: string; };
  beneficiary: { name: string };
  recipient: { name: string; position: string; location: string };
  applicant: { fullName: string; age: string; addressUpper: string; workStatus: string; workplace: string; monthlyIncome: string; expenseType: string; householdExpenses: string; };
  student: { name: string; purok: string };
  property: { titleNumber: string; taxDeclarationNo: string; area: string };
  tree: { count: string; countWord: string; type: string };
}

const ONE_TO_NINETEEN = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function numberToWord(n: number): string { if (Number.isNaN(n)) return ""; if (n < 20) return ONE_TO_NINETEEN[n] || String(n); if (n < 100) { const t = TENS[Math.floor(n / 10)]; const u = n % 10; return u ? `${t} ${ONE_TO_NINETEEN[u]}` : t; } const h = ONE_TO_NINETEEN[Math.floor(n / 100)]; const rest = n % 100; return rest ? `${h} hundred ${numberToWord(rest)}` : `${h} hundred`; }

function stripHonorific(name: string): string { return name.replace(/^HON\.\s*/i, "").trim(); }
function residentFullName(doc: documentRequestInterface): string { const r = doc.resident as { name?: string } | undefined; if (r && typeof r === "object" && r.name) return r.name; return doc.fullName || ""; }
function residentGender(doc: documentRequestInterface): string { const r = doc.resident as { gender?: string } | undefined; return r && typeof r === "object" && typeof r.gender === "string" ? r.gender : ""; }
function civilStatusWord(doc: documentRequestInterface): string { const raw = (doc.civilStatus || "").toLowerCase(); if (!raw) return ""; if (raw.startsWith("single")) return "single"; if (raw.startsWith("married")) return "married"; if (raw.startsWith("widow")) return "widow"; if (raw.startsWith("separated")) return "widow"; if (raw.startsWith("divor")) return "widow"; return raw; }
function civilMark(doc: documentRequestInterface, which: string): string { return civilStatusWord(doc) === which ? "/" : ""; }
function certificatePronoun(doc: documentRequestInterface): string { return /^male$/i.test(residentGender(doc)) ? "his" : "her"; }
function subjectPronoun(doc: documentRequestInterface): string { return /^male$/i.test(residentGender(doc)) ? "He" : "She"; }
function mrMrsFor(doc: documentRequestInterface): string { if (/^male$/i.test(residentGender(doc))) return "Mr."; const status = civilStatusWord(doc); return status === "married" || status === "widow" ? "Mrs." : "Ms."; }
function dayOrdinalFrom(dateIssued: string | number | null | undefined): string { if (dateIssued == null) return ""; const dt = new Date(dateIssued); if (Number.isNaN(dt.getTime())) return ""; const d = dt.getDate(); if (d % 100 >= 11 && d % 100 <= 13) return `${d}TH`; switch (d % 10) { case 1: return `${d}ST`; case 2: return `${d}ND`; case 3: return `${d}RD`; default: return `${d}TH`; } }
function dateShortFrom(dateIssued: string | number | null | undefined): string { if (dateIssued == null) return ""; const dt = new Date(dateIssued); if (Number.isNaN(dt.getTime())) return ""; const month = dt.toLocaleDateString("en-US", { month: "long" }); const day = String(dt.getDate()).padStart(2, "0"); return `${month} ${day}, ${dt.getFullYear()}`; }
function stripCurrencyPrefix(value: string | null | undefined): string { if (!value) return ""; return String(value).replace(/^\s*(php|₱)\s*/i, "").trim(); }

export function buildDocumentData(doc: documentRequestInterface, settings?: barangaySettings, activeByPosition: Record<string, string> = {}, rosterByPosition: Record<string, string[]> = {}): DocxTemplateRenderData {
  const parts = formatDateParts(doc.dateIssued ?? "");
  const barangay = settings?.barangay;
  const dayNumber = parts ? String(new Date(doc.dateIssued as string).getDate()) : "";
  const mayor = settings?.externalRecipients?.find((r) => r.position === "Mayor");

  return {
    resident: { fullName: residentFullName(doc), gender: residentGender(doc), civilStatus: civilStatusWord(doc), purok: doc.purok || "", spouseName: doc.spouseName || "", annualIncome: stripCurrencyPrefix(doc.annualIncome) },
    certificate: { day: dayNumber, dayOrdinal: dayOrdinalFrom(doc.dateIssued), dayOrdinalLower: dayOrdinalFrom(doc.dateIssued).toLowerCase(), month: parts ? parts.month : "", year: parts ? parts.year : "", pronoun: certificatePronoun(doc), subjectPronoun: subjectPronoun(doc), singleMark: civilMark(doc, "single"), marriedMark: civilMark(doc, "married"), widowMark: civilMark(doc, "widow"), mrMrs: mrMrsFor(doc), dateShort: dateShortFrom(doc.dateIssued), purpose: doc.purpose || "" },
    barangay: { name: barangay?.name || "Barangay Rabon", municipality: barangay?.municipality || "Rosario", province: barangay?.province || "La Union", punongBarangay: stripHonorific(activeByPosition["Punong Barangay"] || "") },
    officials: { punongBarangay: stripHonorific(activeByPosition["Punong Barangay"] || ""), secretary: stripHonorific(activeByPosition["Secretary"] || ""), treasurer: stripHonorific(activeByPosition["Treasurer"] || ""), skChairperson: stripHonorific(activeByPosition["SK Chairperson"] || "") },
    sangguniangBarangay: { member0: stripHonorific(rosterByPosition["Barangay Kagawad"]?.[0] || ""), member1: stripHonorific(rosterByPosition["Barangay Kagawad"]?.[1] || ""), member2: stripHonorific(rosterByPosition["Barangay Kagawad"]?.[2] || ""), member3: stripHonorific(rosterByPosition["Barangay Kagawad"]?.[3] || ""), member4: stripHonorific(rosterByPosition["Barangay Kagawad"]?.[4] || ""), member5: stripHonorific(rosterByPosition["Barangay Kagawad"]?.[5] || ""), member6: stripHonorific(rosterByPosition["Barangay Kagawad"]?.[6] || "") },
    beneficiary: { name: doc.assistanceTo || "" },
    recipient: { name: mayor?.name || "", position: mayor?.position || "", location: "" },
    applicant: { fullName: residentFullName(doc), age: doc.age || "", addressUpper: (doc.address || "").toUpperCase(), workStatus: doc.workStatus || "", workplace: doc.workplace || "", monthlyIncome: stripCurrencyPrefix(doc.monthlyIncome), expenseType: doc.expenseType || "", householdExpenses: stripCurrencyPrefix(doc.householdExpenses) },
    student: { name: doc.fullName || "", purok: doc.purok || "" },
    property: { titleNumber: doc.titleNo || "", taxDeclarationNo: doc.taxDeclarationNo || "", area: doc.landArea || "" },
    tree: { count: String(doc.treeCount || "0"), countWord: numberToWord(Number(doc.treeCount || "0")), type: doc.treeType || "" }
  };
}


