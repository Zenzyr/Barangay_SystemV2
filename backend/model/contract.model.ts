import mongoose, { Schema } from 'mongoose';

const ContractSchema = new Schema({
    serviceRequest: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true },
    client: { type: Schema.Types.ObjectId, ref: "Accounts", required: true },
    provider: { type: Schema.Types.ObjectId, ref: "Accounts", required: true },
    skill: { type: String, required: true },
    serviceType: { type: String, required: true },
    description: { type: String, required: true },
    agreedPrice: { type: Number, required: false, default: 0 },
    startDate: { type: String, required: false, default: "" },
    expectedEndDate: { type: String, required: false, default: "" },
    location: { type: String, required: true },
    notes: { type: String, required: false, default: "" },
    status: {
        type: String,
        enum: ["PENDING", "ACTIVE", "COMPLETION_REQUESTED", "COMPLETED", "CANCELLED"],
        default: "ACTIVE",
    },
    completionRequestedAt: { type: Date, required: false },
    completedAt: { type: Date, required: false },
}, { timestamps: true });

export default mongoose.model("Contract", ContractSchema);
