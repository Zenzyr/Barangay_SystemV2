import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import AccountModel from '../model/account.model';
import { ROLES } from '../utils/roles';

// Bootstrap script for the initial Super Admin account.
//
//   npm run seed:superadmin
//
// Env: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD (>= 12 chars), SUPER_ADMIN_NAME.
//
// Behavior:
//   - If the account does not exist: creates it with role "super_admin" (approved).
//   - If the account exists: promotes it to "super_admin" WITHOUT changing the
//     password hash, ID, email, or any other data.
//
// This is the explicit, deterministic Super Admin bootstrap. The same
// requirement can be met later through the Super Admin "Users" page.

const email = (process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD || "";
const name = (process.env.SUPER_ADMIN_NAME || "System Administrator").trim();
const mongodb_uri = process.env.MONGODB_URI || "";

const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

async function run() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  if (!email || !EMAIL_RE.test(email)) {
    console.error("SUPER_ADMIN_EMAIL must be a valid email");
    process.exit(1);
  }
  if (!password || password.length < 12) {
    console.error("SUPER_ADMIN_PASSWORD must be at least 12 characters");
    process.exit(1);
  }

  await mongoose.connect(mongodb_uri);

  const existing = await AccountModel.findOne({ email });

  if (!existing) {
    const hashed = await bcrypt.hash(password, 10);
    await AccountModel.create({
      profile: "",
      name,
      address: "",
      email,
      contact: "",
      password: hashed,
      status: "approved",
      role: ROLES.SUPER_ADMIN,
      gender: "",
      dateOfBirth: "",
      civilStatus: "",
      purok: "",
      voterStatus: "",
      houseHoldNumber: "",
      idImg: { idFront: "", idBack: "", idSelfie: "" },
      skills: [],
      reviews: [],
    });
    console.log(`Created super admin account for ${email}`);
  } else {
    if (existing.role !== ROLES.SUPER_ADMIN) {
      await AccountModel.updateOne(
        { _id: existing._id },
        { $set: { role: ROLES.SUPER_ADMIN, status: "approved" } }
      );
      console.log(
        `Promoted ${email} to super_admin. Password and account data were NOT changed.`
      );
    } else {
      console.log(`${email} is already a super_admin. No changes made.`);
    }
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});