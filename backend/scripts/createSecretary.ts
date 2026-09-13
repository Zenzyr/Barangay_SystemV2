import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import AccountModel from '../model/account.model';

// Creates or upgrades an existing account to the "secretary" role with a
// strong password. Run ONCE after deployment:
//   npm run seed:secretary
// Configure credentials via env (SAFER):
//   SECRETARY_EMAIL, SECRETARY_PASSWORD, SECRETARY_NAME
const email = (process.env.SECRETARY_EMAIL || "").trim().toLowerCase();
const password = process.env.SECRETARY_PASSWORD || "";
const name = (process.env.SECRETARY_NAME || "Barangay Secretary").trim();
const mongodb_uri = process.env.MONGODB_URI || "";

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

async function run() {
  if (!mongodb_uri) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
  }
  if (!email || !EMAIL_RE.test(email)) {
    console.error("SECRETARY_EMAIL must be a valid email");
    process.exit(1);
  }
  if (!password || password.length < 12) {
    console.error("SECRETARY_PASSWORD must be at least 12 characters");
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
      role: "secretary",
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
    console.log(`Created secretary account for ${email}`);
  } else {
    const hashed = await bcrypt.hash(password, 10);
    await AccountModel.findByIdAndUpdate(existing._id, {
      password: hashed,
      role: "secretary",
      status: "approved",
      name: existing.name || name,
    });
    console.log(`Upgraded ${email} to secretary role with a new password`);
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
