import mongoose, { Schema } from 'mongoose';

const ServiceRequestSchema = new Schema({
    client: { type: Schema.Types.ObjectId, ref: "Accounts", required: true },
    provider: { type: Schema.Types.ObjectId, ref: "Accounts", required: true },
    skill: { type: String, required: true },
    serviceType: { type: String, required: true },
    description: { type: String, required: true },
    preferredDate: { type: String, required: false, default: "" },
    preferredTime: { type: String, required: false, default: "" },
    location: { type: String, required: true },
    budget: { type: Number, required: false, default: 0 },
    notes: { type: String, required: false, default: "" },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED"], default: "PENDING" },
}, { timestamps: true });

export default mongoose.model("ServiceRequest", ServiceRequestSchema);
