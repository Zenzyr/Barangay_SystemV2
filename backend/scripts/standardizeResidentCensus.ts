import mongoose from "mongoose";
import dotenv from "dotenv";
import ResidentCensusModel from "../model/residentCensus.model";
import AuditLogModel from "../model/auditLog.model";
import {
  normalizeCensusSex,
  normalizeEducation,
  normalizeOccupation,
  normalizePensioner,
  normalizeYesNoFlag,
  normalizeCellphone,
  normalizeAge,
  hasNoName,
} from "../utils/residentDataStandardization";
import { calculateAge } from "../utils/age";

/**
 * Resident Census Data Standardization — Phase 1 (idempotent, non-destructive).
 *
 *   dry run:   npx ts-node scripts/standardizeResidentCensus.ts            (or --dry-run)
 *   apply:     npx ts-node scripts/standardizeResidentCensus.ts --apply
 *
 * The dry run only READS, prints old/new/resident/reason for every candidate
 * change, and always exits without writing. Apply performs targeted $set
 * updates (never recreating documents) and records each field change in the
 * existing audit log. Running apply twice makes no further changes.
 */

dotenv.config();
const mongodb_uri = process.env.MONGODB_URI || "";
const APPLY = process.argv.includes("--apply");

interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
  reason: string;
}

const reasons = {
  sex: "existing canonical sex representation (M/F)",
  education: "whitespace/format normalization",
  occupationMap: "",
  occupationCase: "case unification to an existing occupation value",
  occupationSpace: "collapse multiple spaces in occupation value",
  pensioner: "whitespace/format normalization",
  flag: "whitespace/format normalization",
  cellphone: "Philippine mobile formatting (leading zero)",
  ageStale: "age recomputed from the valid birthday",
  ageType: "numeric type consistency (age stored as number)",
};

function computeChanges(doc: any): { changes: FieldChange[]; manualReview: string[] } {
  const changes: FieldChange[] = [];
  const manualReview: string[] = [];

  if (hasNoName(doc.name)) {
    manualReview.push(`record ${doc._id} has NO usable name; preserved untouched — identify the person manually`);
  }

  const add = (field: string, before: unknown, after: unknown, reason: string) => {
    if (before !== after) {
      changes.push({ field, before, after, reason });
    }
  };

  add("sex", doc.sex, normalizeCensusSex(doc.sex), reasons.sex);

  add("education", doc.education, normalizeEducation(doc.education), reasons.education);

  const occBefore = doc.occupation;
  const occAfter = normalizeOccupation(occBefore);
  if (occBefore !== occAfter) {
    const key = String(occBefore ?? "").trim().replace(/\s+/g, " ").toUpperCase();
    const reason =
      key in { "FISHER MAN": 1, "HOUSE WIFE": 1, "MID WIFE": 1, "HOUSE KEEPER": 1, "GOV.EMPLOYE": 1, "OFFICE CLARK": 1, "WAITRES": 1 }
        ? `known occupation variant -> canonical (${occAfter})`
        : String(occBefore) !== String(occBefore).trim().replace(/\s+/g, " ")
          ? reasons.occupationSpace
          : reasons.occupationCase;
    add("occupation", occBefore, occAfter, reason);
  }

  add("pensioner", doc.pensioner, normalizePensioner(doc.pensioner), reasons.pensioner);
  add("cellphone", doc.cellphone, normalizeCellphone(doc.cellphone), reasons.cellphone);

  for (const flag of ["is4Ps", "soloParent", "isSenior", "hpnMaintenance", "isPWD"]) {
    add(flag, doc[flag], normalizeYesNoFlag(doc[flag]), reasons.flag);
  }

  add("age", doc.age, normalizeAge(doc.age, doc.birthday), reasons.ageStale);

  return { changes, manualReview };
}

function ageAnalysis(docs: any[]) {
  console.log("\n===== PHASE 8 — AGE / BIRTHDAY CONSISTENCY (individual review) =====");
  let ok = 0;
  for (const d of docs) {
    const bday = String(d.birthday ?? "").trim();
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(bday) && !isNaN(new Date(`${bday}T00:00:00Z`).getTime());
    if (!valid) {
      console.log(`id=${d._id} name=${String(d.name).slice(0, 40)} age=${JSON.stringify(d.age)} birthday=${bday}  -> NOT REVIEWABLE (no valid birthday)`);
      continue;
    }
    const calc = Number(calculateAge(bday));
    const stored = typeof d.age === "number" ? d.age : Number(String(d.age).replace(/\D+/g, ""));
    const isStr = typeof d.age === "string";
    const infant = isStr && String(d.age).trim().toUpperCase().includes("MONTH");
    if (infant) {
      console.log(`id=${d._id} name=${String(d.name).slice(0, 40)} age=${JSON.stringify(d.age)} birthday=${bday} calc=${calc} -> PRESERVE (intentional infant label)`);
    } else if (isStr && /^\d+$/.test(String(d.age).trim()) && Number(d.age) === calc) {
      console.log(`id=${d._id} name=${String(d.name).slice(0, 40)} age="${d.age}" (string) birthday=${bday} calc=${calc} -> TYPE FIX to ${calc} (value unchanged)`);
      ok++;
    } else if (isNaN(stored)) {
      console.log(`id=${d._id} name=${String(d.name).slice(0, 40)} age=${JSON.stringify(d.age)} birthday=${bday} calc=${calc} -> PRESERVE (unknown age string)`);
    } else if (Math.abs(calc - stored) <= 1) {
      ok++;
    } else {
      console.log(`id=${d._id} name=${String(d.name).slice(0, 40)} age=${stored} (stored) birthday=${bday} calc=${calc} diff=${calc - stored} -> FIX age to ${calc}`);
    }
  }
  console.log(`Age/birthday records consistent (incl. type fixes): ${ok}`);
}

function fieldBeforeAfter(label: string, docs: any[], pick: (d: any) => any, project: (d: any) => any) {
  const dist = (list: any[]) => {
    const map = new Map<string, number>();
    for (const v of list) {
      const k = typeof v === "string" ? v : JSON.stringify(v);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n}x ${k}`);
  };
  const before = dist(docs.map(pick));
  const after = dist(docs.map(project));
  console.log(`\n----- ${label} -----`);
  console.log("BEFORE:");
  before.forEach((l) => console.log(`  ${l}`));
  console.log("PROJECTED AFTER:");
  after.forEach((l) => console.log(`  ${l}`));
}

const CANONICAL_OCC = new Set([
  "N/A", "FISHERMAN", "FISH VENDOR", "HOUSEWIFE", "HOUSEKEEPER",
  "BUSINESS MAN", "BUSINESS WOMAN", "CALL CENTER", "CARPENTER", "CREW",
  "EVENT ORGANIZER", "FACTORY WORKER", "FARMER", "GOV. EMPLOYEE",
  "HAIR AND MAKE UP ARTIST", "LDP DRESSER", "LNP", "MIDWIFE", "OEW",
  "OFFICE", "OFFICE CLERK", "OFFICE WORK", "OFW", "PAINTER", "PHARMACIST",
  "SALES LADY", "STORE OWNER", "WAITRESS",
]);

async function main() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set in .env - aborting.");
    process.exit(1);
  }
  await mongoose.connect(mongodb_uri);

  const docs = await ResidentCensusModel.find({}).lean();
  console.log(`Loaded ${docs.length} resident census records. Mode: ${APPLY ? "APPLY" : "DRY-RUN (no writes)"}`);

  const planned: { id: string; name: string; changes: FieldChange[]; manual: string[] }[] = [];
  const allManual: string[] = [];

  for (const d of docs) {
    const { changes, manualReview } = computeChanges(d);
    if (manualReview.length) allManual.push(...manualReview.map((m) => `  ${m}`));
    if (changes.length) planned.push({ id: String(d._id), name: String(d.name ?? ""), changes, manual: manualReview });
  }

  const byField = new Map<string, { old: unknown; count: number }[]>();
  for (const p of planned) {
    for (const c of p.changes) {
      const list = byField.get(c.field) || [];
      const existing = list.find((e) => JSON.stringify(e.old) === JSON.stringify(c.before));
      if (existing) existing.count++;
      else {
        list.push({ old: c.before, count: 1 });
        byField.set(c.field, list);
      }
    }
  }

  if (planned.length === 0) {
    console.log("\nNo changes detected. MongoDB is already standardized — nothing to do.");
    await mongoose.disconnect();
    return;
  }

  console.log("\n===== PHASE 18 — BEFORE / AFTER (per field) =====");
  console.log(`(records projected to change: ${planned.length})`);
  fieldBeforeAfter("SEX", docs, (d) => d.sex, (d) => normalizeCensusSex(d.sex));
  fieldBeforeAfter("EDUCATION", docs, (d) => d.education, (d) => normalizeEducation(d.education));
  fieldBeforeAfter("OCCUPATION", docs, (d) => d.occupation, (d) => normalizeOccupation(d.occupation));
  fieldBeforeAfter("PENSIONER", docs, (d) => d.pensioner, (d) => normalizePensioner(d.pensioner));
  fieldBeforeAfter("CELLPHONE", docs, (d) => d.cellphone, (d) => normalizeCellphone(d.cellphone));
  fieldBeforeAfter("AGE", docs, (d) => d.age, (d) => normalizeAge(d.age, d.birthday));

  console.log("\n===== CANDIDATE CHANGES — old value -> new value (record count) =====");
  for (const [field, list] of byField) {
    for (const e of list) {
      const example = planned.find((p) => p.changes.some((c) => c.field === field && JSON.stringify(c.before) === JSON.stringify(e.old)));
      const exampleNew = example?.changes.find((c) => c.field === field && JSON.stringify(c.before) === JSON.stringify(e.old))?.after;
      console.log(`${field}\t${JSON.stringify(e.old)} -> ${JSON.stringify(exampleNew)}\t(${e.count} records)`);
    }
  }

  console.log("\n===== PER-RECORD CHANGES (id / name / field / old -> new / reason) =====");
  for (const p of planned) {
    console.log(`\nResident: ${p.id}`);
    console.log(`Name: ${p.name || "(no name)"}`);
    for (const c of p.changes) {
      console.log(`  Field: ${c.field}`);
      console.log(`  Old:   ${JSON.stringify(c.before)}`);
      console.log(`  New:   ${JSON.stringify(c.after)}`);
      console.log(`  Reason: ${c.reason}`);
    }
  }

  ageAnalysis(docs);

  console.log("\n===== PHASE 9 — RECORD WITHOUT USABLE NAME =====");
  const noName = docs.filter((d) => hasNoName(d.name));
  if (noName.length === 0) {
    console.log("None.");
  } else {
    for (const d of noName) {
      console.log(`id=${d._id} ${JSON.stringify({ name: d.name, sex: d.sex, birthday: d.birthday, age: d.age, purok: d.purok, householdNumber: d.householdNumber, isSenior: d.isSenior, hpnMaintenance: d.hpnMaintenance, pensioner: d.pensioner, accountId: d.accountId, isArchived: d.isArchived })}`);
      console.log("  -> REAL DATA PRESENT; PRESERVED UNTOUCHED. Requires manual identity review (phase 9).");
    }
  }

  console.log("\n===== PRESERVED / REQUIRES MANUAL REVIEW =====");
  const preservedOcc = [...new Set(docs.map((d) => d.occupation).filter((v) => {
    const after = normalizeOccupation(v);
    return after === v && !v.includes("  ");
  }))].filter((v) => !CANONICAL_OCC.has(String(v ?? "").toUpperCase()) && v && String(v) !== "N/A");
  preservedOcc.forEach((v) => console.log(`  occupation "${JSON.stringify(v)}" preserved (ambiguous) — manual review`));
  if (allManual.length) allManual.forEach((l) => console.log(l));
  else console.log("  (none)");

  if (!APPLY) {
    console.log("\nDRY RUN COMPLETE — no writes performed. Review before running with --apply.");
    await mongoose.disconnect();
    return;
  }

  console.log("\n===== APPLYING (targeted updates only) =====");
  let changedRecords = 0;
  const auditEntries: any[] = [];

  for (const p of planned) {
    const set: Record<string, unknown> = {};
    for (const c of p.changes) set[c.field] = c.after;
    const res = await ResidentCensusModel.updateOne({ _id: p.id }, { $set: set });
    if (res.modifiedCount > 0) {
      changedRecords++;
      for (const c of p.changes) {
        auditEntries.push({
          actor: "System — Census Data Standardization (Phase 1)",
          actorId: "",
          action: "standardize",
          entity: "residentCensus",
          entityId: p.id,
          entityLabel: p.name || "(no name)",
          field: c.field,
          previousValue: c.before,
          newValue: c.after,
        });
      }
    }
  }

  if (auditEntries.length) {
    await AuditLogModel.insertMany(auditEntries, { ordered: false });
  }

  console.log(`Records updated: ${changedRecords}`);
  console.log(`Audit log entries written: ${auditEntries.length}`);

  await mongoose.disconnect();
  console.log(`\nPHASE 1 STANDARDIZATION ${APPLY ? "APPLIED" : "PREVIEWED"}. Re-run without --apply to confirm idempotency (should report 0 changes).`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});