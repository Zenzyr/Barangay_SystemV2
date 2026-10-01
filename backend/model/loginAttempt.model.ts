import mongoose, { Schema } from "mongoose";

const LoginAttemptSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
    },
    attempts: { type: Number, required: false, default: 0 },
    lockedUntil: { type: Date, required: false },
    lastAttemptAt: { type: Date, required: false },
  },
  { timestamps: true }
);

LoginAttemptSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("LoginAttempt", LoginAttemptSchema);
