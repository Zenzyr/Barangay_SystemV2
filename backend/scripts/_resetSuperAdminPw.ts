import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import AccountModel from '../model/account.model';

// One-off: reset ONLY the super admin password hash so it matches the
// value now stored in .env. No other field/account is modified.
(async () => {
  const uri = process.env.MONGODB_URI || "";
  if (!uri) throw new Error("MONGODB_URI is not set");
  const email = (process.env.SUPER_ADMIN_EMAIL || "superadmin@barangay.gov.ph").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD || "";
  if (!password || password.length < 12) {
    throw new Error("SUPER_ADMIN_PASSWORD is not set or too short");
  }

  await mongoose.connect(uri);
  const account = await AccountModel.findOne({ email });
  if (!account) throw new Error(`Super admin account not found: ${email}`);

  const hashed = await bcrypt.hash(password, 10);
  await AccountModel.updateOne({ _id: account._id }, { $set: { password: hashed } });

  const saved = await AccountModel.findById(account._id).select("email role status password");
  if (!saved) throw new Error("Could not reload account");
  const ok = await bcrypt.compare(password, saved.password);
  if (!ok) throw new Error("Password verification failed");
  console.log(
    `Password reset OK for ${saved.email} (role=${saved.role}, status=${saved.status}). New password verified with bcrypt.`
  );
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});