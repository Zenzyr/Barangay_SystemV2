import 'dotenv/config';
import mongoose from 'mongoose';
import AccountModel from '../model/account.model';
import { ROLES } from '../utils/roles';

// SAFE THREE-ROLE MIGRATION (resident / secretary / super_admin)
//
// Rules honored:
//   - Uses the existing `accounts` collection. No new collection.
//   - NEVER deletes accounts, NEVER touches _id / password / email / data.
//   - Only the `role` field may change, and only for accounts explicitly
//     listed in SUPER_ADMIN_EMAILS.
//   - Existing secretaries stay secretaries unless explicitly promoted.
//   - Idempotent: running twice produces no additional changes.
//   - DRY-RUN by default. Pass `--apply` to write to the database.
//
// Usage:
//   SUPER_ADMIN_EMAILS=admin@example.com npm run migrate:roles        (preview)
//   SUPER_ADMIN_EMAILS=admin@example.com npm run migrate:roles:apply  (apply)

const CANONICAL_ROLES: string[] = [ROLES.RESIDENT, ROLES.SECRETARY, ROLES.SUPER_ADMIN];
const LEGACY_ADMIN_LIKE = new Set(["admin", "administrator", "superadmin", "super-admin", "Admin", "Administrator"]);

const apply = process.argv.includes("--apply");
const mongodb_uri = process.env.MONGODB_URI || "";
const superAdminEmails = (process.env.SUPER_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function run() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(mongodb_uri);

  const total = await AccountModel.countDocuments({});
  const distribution = await AccountModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  const byRole: Record<string, number> = {};
  for (const row of distribution) {
    byRole[row._id || "(missing)"] = row.count;
  }

  const unexpected = Object.keys(byRole).filter((r) => !CANONICAL_ROLES.includes(r));

  console.log("==============================================");
  console.log("  ROLE MIGRATION PREVIEW");
  console.log(`  Mode: ${apply ? "APPLY (writes to database)" : "DRY RUN (no changes written)"}`);
  console.log("==============================================");

  if (superAdminEmails.length) {
    console.log(`SUPER_ADMIN_EMAILS: ${superAdminEmails.join(", ")}`);
  } else {
    console.log("SUPER_ADMIN_EMAILS: (none configured)");
  }

  console.log(`\nTotal accounts: ${total}`);
  console.log("\nCurrent role distribution:");
  for (const role of CANONICAL_ROLES) {
    console.log(`  ${role}: ${byRole[role] || 0}`);
  }

  if (unexpected.length) {
    console.log("\nUnexpected / legacy roles present (NOT auto-converted):");
    for (const role of unexpected) {
      console.log(`  "${role}": ${byRole[role]}`);
    }
  }

  // Determine who will become super_admin
  const matches = superAdminEmails.length
    ? await AccountModel.find({ email: { $in: superAdminEmails } })
    : [];
  const found = new Set(matches.map((a) => a.email));
  const missing = superAdminEmails.filter((e) => !found.has(e));
  const toPromote = matches.filter((a) => a.role !== ROLES.SUPER_ADMIN);
  const alreadySuper = matches.filter((a) => a.role === ROLES.SUPER_ADMIN);
  const legacyMatches = matches.filter((a) => LEGACY_ADMIN_LIKE.has(String(a.role || "")));

  console.log("\nAccounts that WILL become super_admin:");
  if (!toPromote.length) console.log("  (none)");
  toPromote.forEach((a) =>
    console.log(`  - ${a.email}  |  role: ${a.role || "(missing)"} -> super_admin  |  id: ${a._id}`)
  );

  if (alreadySuper.length) {
    console.log("\nAlready super_admin (no change):");
    alreadySuper.forEach((a) => console.log(`  = ${a.email} (id: ${a._id})`));
  }

  if (legacyMatches.length) {
    console.log("\nAllowlisted accounts carrying a legacy role string (will be normalized to super_admin):");
    legacyMatches.forEach((a) => console.log(`  ! ${a.email} | legacy role: "${a.role}"`));
  }

  if (missing.length) {
    console.log("\nWARNING — configured emails with NO matching account (skipped):");
    missing.forEach((e) => console.log(`  ? ${e}`));
  }

  if (unexpected.length) {
    console.log(
      `\nLegacy/unexpected roles exist for ${unexpected.length} role value(s). ` +
        "These accounts are LEFT UNTOUCHED. They will not pass any staff guard until corrected."
    );
  }

  const changesNeeded = toPromote.length > 0 || legacyMatches.length > 0;
  if (!changesNeeded) {
    console.log("\nNo migrations needed. Database is already aligned.");
    await mongoose.disconnect();
    return;
  }

  if (!apply) {
    console.log("\n=== DRY RUN COMPLETE — NO DATA WAS MODIFIED ===");
    console.log("Re-run with `--apply` to write these changes.");
    await mongoose.disconnect();
    return;
  }

  const updates = [...toPromote, ...legacyMatches.filter((a) => a.role !== ROLES.SUPER_ADMIN)];
  for (const account of updates) {
    await AccountModel.updateOne({ _id: account._id }, { $set: { role: ROLES.SUPER_ADMIN } });
  }
  console.log(
    `\n=== MIGRATION APPLIED ===\nUpdated ${updates.length} account(s) to super_admin.\n` +
      "Only the role field was modified. No passwords, IDs, emails, or other data changed."
  );

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});