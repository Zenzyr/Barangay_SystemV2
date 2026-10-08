import 'dotenv/config';
import mongoose from 'mongoose';
import AccountModel from '../model/account.model';
import { formatFullName, normalizeNamePart } from '../utils/personName';
import { isName } from '../utils/validation';

const apply = process.argv.includes("--apply");
const rollback = process.argv.includes("--rollback");
const mongodb_uri = process.env.MONGODB_URI || "";

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v", "vi"]);

type Proposal = { firstName: string; middleName: string; lastName: string };

const propose = (rawName: unknown): Proposal | null => {
  const name = normalizeNamePart(rawName);
  if (!name || name.includes(",") || !isName(name)) return null;
  const tokens = name.split(" ");
  if (tokens.length !== 2) return null;
  if (tokens.some((t) => SUFFIXES.has(t.toLowerCase().replace(/\./g, "")))) return null;
  const parts = { firstName: tokens[0], middleName: "", lastName: tokens[1] };
  return formatFullName(parts) === name ? parts : null;
};

async function runRollback() {
  const filter = { nameBackfilledAt: { $exists: true } };
  const count = await AccountModel.collection.countDocuments(filter);
  console.log(`Accounts backfilled by this script: ${count}`);
  if (!apply) {
    console.log("DRY RUN: pass --rollback --apply to remove the backfilled name parts.");
    return;
  }
  const result = await AccountModel.collection.updateMany(filter, {
    $unset: { firstName: "", middleName: "", lastName: "", nameBackfilledAt: "" },
  });
  console.log(`Rolled back: ${result.modifiedCount}`);
}

async function runBackfill() {
  const candidates = await AccountModel.collection
    .find({ $or: [{ lastName: { $exists: false } }, { lastName: "" }, { lastName: null }] })
    .project({ _id: 1, name: 1, email: 1, role: 1 })
    .toArray();

  const ready: { id: mongoose.Types.ObjectId; name: string; parts: Proposal }[] = [];
  const manual: { id: mongoose.Types.ObjectId; name: string; email: string }[] = [];

  for (const account of candidates) {
    const parts = propose(account.name);
    if (parts) ready.push({ id: account._id, name: String(account.name), parts });
    else manual.push({ id: account._id, name: String(account.name ?? ""), email: String(account.email ?? "") });
  }

  console.log("==============================================");
  console.log("  ACCOUNT NAME-PARTS BACKFILL");
  console.log(`  Mode: ${apply ? "APPLY (writes to database)" : "DRY RUN (no changes written)"}`);
  console.log("==============================================");
  console.log(`Accounts without structured names: ${candidates.length}`);
  console.log(`Unambiguous (first + last only): ${ready.length}`);
  console.log(`Left unchanged for manual review: ${manual.length}`);

  ready.slice(0, 50).forEach((r) =>
    console.log(`  + ${r.id} "${r.name}" -> first="${r.parts.firstName}" last="${r.parts.lastName}"`),
  );
  manual.slice(0, 50).forEach((m) => console.log(`  ? ${m.id} "${m.name}" <${m.email}>`));

  if (!apply) {
    console.log("\nDRY RUN: pass --apply to write. The display name field is never modified.");
    return;
  }

  let written = 0;
  for (const r of ready) {
    const result = await AccountModel.collection.updateOne(
      { _id: r.id, name: r.name, $or: [{ lastName: { $exists: false } }, { lastName: "" }, { lastName: null }] },
      { $set: { ...r.parts, nameBackfilledAt: new Date() } },
    );
    written += result.modifiedCount;
  }
  console.log(`\nBackfilled: ${written}`);
}

async function run() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  await mongoose.connect(mongodb_uri);
  try {
    if (rollback) await runRollback();
    else await runBackfill();
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
