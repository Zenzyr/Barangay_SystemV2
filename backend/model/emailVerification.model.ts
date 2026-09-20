import mongoose, { Schema } from "mongoose";

// Tracks email-ownership OTP state BEFORE an account is created, so the
// applicant must prove they control the inbox before registration completes.
// One document per email; all OTP material is stored HASHED only.
const EmailVerificationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
    },
    otpHash: { type: String, required: false },
    otpExpiresAt: { type: Date, required: false },
    attempts: { type: Number, required: false, default: 0 },
    resendCooldownUntil: { type: Date, required: false },
    blockedUntil: { type: Date, required: false },
    verified: { type: Boolean, required: false, default: false },
    verifiedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

EmailVerificationSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("EmailVerification", EmailVerificationSchema);