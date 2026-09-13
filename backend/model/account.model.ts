import mongoose, { Schema } from 'mongoose';


const AccountSchema = new Schema({
    profile: { type: String, required: false, default: "" },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    contact: { type: String, required: false, default: "" },
    address: { type: String, required: false, trim: true, maxlength: 255, default: "" },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
    },

    gender: { type: String, required: false, default: "" },
    dateOfBirth: { type: String, required: false, default: "" },
    civilStatus: { type: String, required: false, default: "" },
    purok: { type: String, required: false, default: "" },
    voterStatus: { type: String, required: false, default: "" },
    houseHoldNumber: { type: String, required: false, default: "" },

    password: { type: String, required: true },
    status :  { type: String, required: true },
    role: { type: String, enum: ["resident", "secretary", "super_admin"], default: "resident" },
    resetCodeHash: { type: String, required: false },
    resetCodeExpires: { type: Date, required: false },

    // ── ONE PERSON = ONE ACCOUNT ────────────────────────────────
    // identityHash is a deterministic fingerprint over (DOB, first, last)
    // for accounts that carry a full identity. The sparse unique index is
    // the race-condition backstop: two simultaneous registrations of the
    // same person cannot both be created. It is omitted (undefined) for
    // accounts without a parseable DOB, so those are skipped by the index.
    identityHash: { type: String, required: false },
    // Set when registration partially matches an existing record; the
    // verifying clerk reviews it before approval. Operational flag only.
    possibleDuplicate: {
      status: { type: String },
      reason: { type: String },
      records: [{ type: Schema.Types.Mixed }],
    },

    // ── Service provider marketplace fields ──────────────────────
    availability: { type: String, enum: ["AVAILABLE", "BUSY", "NOT_AVAILABLE"], default: "AVAILABLE" },
    providerLocation: { type: String, required: false, default: "" },
    providerDescription: { type: String, required: false, default: "" },
    completedServices: { type: Number, required: false, default: 0 },
    idImg : {
        idFront  :  { type: String, required: false, default: "" },
        idBack :  { type: String, required: false, default: "" },
        idSelfie :  { type: String, required: false, default: "" },
    },
    skills : [{
        skill  :  { type: String, required: true },
        experience :  { type: Number, required: true },
        proficiency :  { type: String, required: true },
        serviceTypes : [{ type: String }],
        availability : { type: String, enum: ["available", "busy"], default: "available" },
        services : [{ type: String }],
    }],
    reviews : [{
        user :   { type: String, required: true },
        userProfile : { type: String, required: true },
        star  :  { type: Number, required: true },
        skill :  { type: String, required: true },
        message :  { type: String, required: true },
    }],
}, {
  // Creation timestamp for the verification register (new registrations).
  timestamps: true,
});

// Race-safe ONE-PERSON-ONE-ACCOUNT backstop (skip docs without a hash).
AccountSchema.index({ identityHash: 1 }, { unique: true, sparse: true });

export default mongoose.model('Accounts', AccountSchema)