import mongoose, { Schema } from "mongoose";

const SuspensionAppealSchema = new Schema(
  {
    accountId: { type: String, required: true, index: true },
    reason: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: { type: String, required: false, default: "" },
    reviewedAt: { type: Date, required: false },
    decisionNote: { type: String, required: false, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export default mongoose.model("SuspensionAppeal", SuspensionAppealSchema);
