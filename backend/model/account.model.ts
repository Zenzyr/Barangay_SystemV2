import mongoose, { Schema } from "mongoose";

const AccountSchema = new Schema(
  {
    profile: { type: String, required: false, default: "" },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    firstName: { type: String, required: false, trim: true, maxlength: 50 },
    middleName: { type: String, required: false, trim: true, maxlength: 50 },
    lastName: { type: String, required: false, trim: true, maxlength: 50 },
    nickname: {
      type: String,
      required: false,
      trim: true,
      maxlength: 100,
      default: "",
    },
    contact: { type: String, required: false, default: "" },
    address: {
      type: String,
      required: false,
      trim: true,
      maxlength: 255,
      default: "",
    },
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
    age: { type: String, required: false, default: "" },
    civilStatus: { type: String, required: false, default: "" },
    purok: { type: String, required: false, default: "" },
    voterStatus: { type: String, required: false, default: "" },
    houseHoldNumber: { type: String, required: false, default: "" },
    idType: {
      type: String,
      enum: ["national_id", "voters_id"],
      required: false,
    },

    password: { type: String, required: true },
    status: { type: String, required: true },
    role: {
      type: String,
      enum: ["resident", "secretary", "super_admin", "treasurer"],
      default: "resident",
    },

    isSuspended: { type: Boolean, required: false, default: false },
    suspendedAt: { type: Date, required: false },
    suspendedBy: { type: String, required: false, default: "" },
    suspensionReason: { type: String, required: false, default: "" },
    // Email-ownership verification. register() only sets this true after the
    // applicant proved control of the inbox with a valid, non-expired OTP;
    // login refuses accounts explicitly marked false.
    emailVerified: { type: Boolean, required: false, default: false },
    emailVerifiedAt: { type: Date, required: false },
    // Last successful sign-in fingerprint. Compared against the incoming
    // request on each login to detect and warn about a new device/location.
    lastLoginAt: { type: Date, required: false },
    lastLoginIp: { type: String, required: false, default: "" },
    lastLoginUserAgent: { type: String, required: false, default: "" },
    resetCodeHash: { type: String, required: false },
    resetCodeExpires: { type: Date, required: false },
    // Brute-force protection for the password-reset code: failed verify attempts
    // per account, and a temporary lock once the ceiling is reached.
    resetAttempts: { type: Number, required: false, default: 0 },
    resetBlockedUntil: { type: Date, required: false },
    // Resend throttle: no new code is issued within this window, so a spammer
    // cannot burn SMS credits by hammering forgot-password.
    resetCodeCooldownUntil: { type: Date, required: false },
    // Delivery channel the current code was issued for ("email" | "sms").
    // verifyResetCode requires a match so a code issued for one channel cannot
    // be redeemed through the other.
    resetCodeMethod: { type: String, required: false },

    // Phone-number verification that gates the password-reset flow: failed
    // "09 + last two digits" attempts per account and a temporary lock once
    // the ceiling is reached. Independent from resetAttempts so the two steps
    // cannot reset each other's counters.
    phoneVerifyAttempts: { type: Number, required: false, default: 0 },
    phoneVerifyBlockedUntil: { type: Date, required: false },

    // Single-use password-reset token issued after the code is verified. The
    // token carries a random id (jti) whose hash is stored here; resetPassword
    // matches it and clears it, so an observed/leaked token cannot be replayed.
    resetTokenHash: { type: String, required: false },
    resetTokenExpires: { type: Date, required: false },

    // ── Optional two-factor authentication (email OTP) ──────────────
    // Opt-in from account settings. When enabled, correct email+password no
    // longer completes sign-in: a 6-digit code is emailed and must be verified
    // before a session token is issued. Attempt counters are independent from
    // the password/reset counters.
    twoFactorEnabled: { type: Boolean, required: false, default: false },
    // The live OTP hash and the recovery-code hashes are secrets: `select:
    // false` keeps them out of every normal query/response (login, profile,
    // admin lists). They are only read back via an explicit +select.
    twoFactorOtpHash: { type: String, required: false, select: false },
    twoFactorOtpExpires: { type: Date, required: false },
    twoFactorOtpAttempts: { type: Number, required: false, default: 0 },
    twoFactorOtpBlockedUntil: { type: Date, required: false },
    twoFactorOtpCooldownUntil: { type: Date, required: false },
    // One-time recovery codes (bcrypt hashes). Consumed on use so a leaked code
    // cannot be replayed; shown in plaintext only once, at generation time.
    twoFactorRecoveryHashes: {
      type: [String],
      required: false,
      default: [],
      select: false,
    },
    twoFactorRecoveryUpdatedAt: { type: Date, required: false },

    // ── ONE PERSON = ONE ACCOUNT ────────────────────────────────
    // identityHash is a deterministic fingerprint over (DOB, first, last)
    // for accounts that carry a full identity. The sparse unique index is
    // the race-condition backstop: two simultaneous registrations of the
    // same person cannot both be created. It is omitted (undefined) for
    // accounts without a parseable DOB, so those are skipped by the index.
    identityHash: { type: String, required: false },
    // Link to the ResidentCensus record for this person. Set automatically
    // when registration matches an existing census entry, so the census and
    // the account stay in sync (edits on one side update the other).
    censusId: {
      type: Schema.Types.ObjectId,
      ref: "ResidentCensus",
      required: false,
    },
    // Set when registration partially matches an existing record; the
    // verifying clerk reviews it before approval. Operational flag only.
    possibleDuplicate: {
      status: { type: String },
      reason: { type: String },
      records: [{ type: Schema.Types.Mixed }],
    },

    // ── Service provider marketplace fields ──────────────────────
    availability: {
      type: String,
      enum: ["AVAILABLE", "BUSY", "NOT_AVAILABLE"],
      default: "AVAILABLE",
    },
    providerLocation: { type: String, required: false, default: "" },
    providerDescription: { type: String, required: false, default: "" },
    completedServices: { type: Number, required: false, default: 0 },
    idImg: {
      idFront: { type: String, required: false, default: "" },
      idBack: { type: String, required: false, default: "" },
      idSelfie: { type: String, required: false, default: "" },
    },
    skills: [
      {
        skill: { type: String, required: true },
        experience: { type: Number, required: true },
        proficiency: { type: String, required: true },
        serviceTypes: [{ type: String }],
        availability: {
          type: String,
          enum: ["available", "busy"],
          default: "available",
        },
        services: [{ type: String }],
      },
    ],
    reviews: [
      {
        user: { type: String, required: true },
        userProfile: { type: String, required: true },
        star: { type: Number, required: true },
        skill: { type: String, required: true },
        message: { type: String, required: true },
      },
    ],

    // Data Privacy Act consent record. Must live INSIDE the schema — as a
    // SchemaOptions key it was silently dropped and never persisted.
    legalConsent: {
      privacyPolicy: { type: Boolean, required: false },
      termsOfService: { type: Boolean, required: false },
      privacyPolicyVersion: { type: String, required: false },
      termsOfServiceVersion: { type: String, required: false },
      acceptedAt: { type: Date, required: false },
    },
  },

  {
    // Creation timestamp for the verification register (new registrations).
    timestamps: true,
  },
);

// Race-safe ONE-PERSON-ONE-ACCOUNT backstop (skip docs without a hash).
AccountSchema.index({ identityHash: 1 }, { unique: true, sparse: true });
// Fast lookups when syncing a census record back to its linked account.
AccountSchema.index({ censusId: 1 });

export default mongoose.model("Accounts", AccountSchema);
