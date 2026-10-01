import mongoose, { Schema } from 'mongoose';

const ScheduleSlotSchema = new Schema({
    provider: { type: Schema.Types.ObjectId, ref: "Accounts", required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    bookedCount: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

ScheduleSlotSchema.index({ provider: 1, date: 1, startTime: 1 }, { unique: true });
ScheduleSlotSchema.index({ date: 1 });

export default mongoose.model("ScheduleSlot", ScheduleSlotSchema);
