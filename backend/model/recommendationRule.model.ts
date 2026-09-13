import mongoose, { Schema } from 'mongoose';

const RecommendationRuleSchema = new Schema({
  category: { type: String, required: true },
  problemName: { type: String, required: true },
  indicator: { type: String, required: true },
  operator: { type: String, required: true, enum: [">", ">=", "<", "<=", "=="] },
  threshold: { type: Number, required: true },
  programName: { type: String, required: true },
  priorityLevel: { type: String, required: true, enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"] },
  description: { type: String, required: false, default: "" },
  status: { type: String, required: true, enum: ["active", "inactive"], default: "active" },
}, { timestamps: true });

export default mongoose.model("RecommendationRule", RecommendationRuleSchema);
