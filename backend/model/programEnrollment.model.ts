import mongoose, { Schema } from "mongoose";

// A persisted record that staff have marked a resident as a beneficiary of a
// program (4Ps / TUPAD). Separate from the census so the recommendation signal
// is preserved even if the underlying census record later changes.
const ProgramEnrollmentSchema = new Schema(
  {
    program: {
      type: String,
      enum: ["4Ps", "TUPAD"],
      required: true,
    },
    censusId: {
      type: Schema.Types.ObjectId,
      ref: "ResidentCensus",
      required: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      required: false,
    },
    name: { type: String, required: true, default: "N/A" },
    householdNumber: { type: String, required: true, default: "N/A" },
    monthlySalary: { type: Number, required: false, default: 0 },
    householdTotalIncome: { type: Number, required: false, default: 0 },
    // 4Ps batch (1-based) the individual fell into at enrollment time; 0 when
    // not applicable (TUPAD has no batching).
    batchNumber: { type: Number, required: false, default: 0 },
    status: {
      type: String,
      enum: ["enrolled", "removed"],
      default: "enrolled",
    },
    note: { type: String, required: false, default: "" },
    enrolledBy: { type: String, required: false, default: "" },
    enrolledById: { type: String, required: false, default: "" },
  },
  { timestamps: true },
);

// One active enrollment per (program, person). Re-enrolling updates the row
// instead of creating a duplicate.
ProgramEnrollmentSchema.index(
  { program: 1, censusId: 1 },
  { unique: true },
);
ProgramEnrollmentSchema.index({ program: 1, status: 1 });

export default mongoose.model("ProgramEnrollment", ProgramEnrollmentSchema);
