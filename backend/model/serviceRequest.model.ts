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
    scheduledDate: { type: String, required: false },
    scheduleStartTime: { type: String, required: false },
    scheduleEndTime: { type: String, required: false },
    scheduleSlot: { type: Schema.Types.ObjectId, ref: "ScheduleSlot", required: false },
}, { timestamps: true });

ServiceRequestSchema.index({ client: 1, createdAt: -1 });
ServiceRequestSchema.index({ provider: 1, createdAt: -1 });
ServiceRequestSchema.index({ scheduledDate: 1 });

export default mongoose.model("ServiceRequest", ServiceRequestSchema);
