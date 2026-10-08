import 'dotenv/config';
import mongoose from 'mongoose';
import DocumentRequestModel from '../model/documentRequest.model';

const apply = process.argv.includes("--apply");
const mongodb_uri = process.env.MONGODB_URI || "";

const LEGACY_FILTER = {
  isPaid: true,
  paymentVerificationStatus: { $exists: false },
};

async function run() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(mongodb_uri);

  const total = await DocumentRequestModel.countDocuments({});
  const legacyPaid = await DocumentRequestModel.countDocuments(LEGACY_FILTER);
  const distribution = await DocumentRequestModel.aggregate<{ _id: string | null; count: number }>([
    { $match: { $or: [{ isPaid: true }, { paymentVerificationStatus: { $exists: true } }] } },
    { $group: { _id: "$paymentVerificationStatus", count: { $sum: 1 } } },
  ]);

  console.log("==============================================");
  console.log("  PAYMENT VERIFICATION BACKFILL");
  console.log(`  Mode: ${apply ? "APPLY (writes to database)" : "DRY RUN (no changes written)"}`);
  console.log("==============================================");
  console.log(`Total document requests: ${total}`);
  console.log("Current verification status of recorded payments:");
  for (const row of distribution) {
    console.log(`  ${row._id ?? "(not set — legacy)"}: ${row.count}`);
  }
  console.log(`\nLegacy paid records to mark as verified: ${legacyPaid}`);

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to write these changes.");
    await mongoose.disconnect();
    return;
  }

  const at = new Date();
  const result = await DocumentRequestModel.updateMany(LEGACY_FILTER, {
    $set: { paymentVerificationStatus: "verified" },
    $push: {
      paymentHistory: {
        action: "verified",
        at,
        byName: "System migration",
        note: "Payment recorded before treasurer verification was introduced",
      },
    },
  });
  console.log(`\nUpdated ${result.modifiedCount} record(s).`);

  await DocumentRequestModel.createIndexes();
  console.log("Indexes ensured.");

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
