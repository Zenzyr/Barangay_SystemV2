import mongoose, { Schema } from 'mongoose';

const ResidentCensusSchema = new Schema({
  name: { type: String, required: true, default: "N/A" },
  sex: { type: String, required: true, default: "N/A" },
  birthday: { type: String, required: true, default: "N/A" },
  age: { type: Schema.Types.Mixed, required: true, default: "N/A" },
  occupation: { type: String, required: true, default: "N/A" },
  education: { type: String, required: true, default: "N/A" },
  purok: { type: String, required: true, default: "N/A" },
  householdNumber: { type: String, required: true, default: "N/A" },
  is4Ps: { type: String, required: true, default: "N/A" },
  soloParent: { type: String, required: true, default: "N/A" },
  familyPlanning: { type: String, required: true, default: "N/A" },
  isSenior: { type: String, required: true, default: "N/A" },
  hpnMaintenance: { type: String, required: true, default: "N/A" },
  pensioner: { type: String, required: true, default: "N/A" },
  isPWD: { type: String, required: true, default: "N/A" },
  cellphone: { type: String, required: true, default: "N/A" },
  // Link to the Accounts collection for census residents who also
  // registered an account online. Set automatically by upsertFromAccount.
  accountId: { type: Schema.Types.ObjectId, ref: "Accounts", required: false },
}, { timestamps: true });

// Fast duplicate-prevention lookups (name + birthday are the identity key).
ResidentCensusSchema.index({ name: 1, birthday: 1 });

export default mongoose.model("ResidentCensus", ResidentCensusSchema);
