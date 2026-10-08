import mongoose, { Schema } from 'mongoose';


const WorkSchema = new Schema({
    client : { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: true },
    worker : { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: true },
    status : { type: String, required: true, enum: ["pending", "active", "accepted", "to review", "completed", "rejected", "cancelled"] },
    service : { type: String, required: true },
    skill : { type: String, required: false },
    description : { type: String, required: true },
    date : { type: String, required: true },
    scheduledDate : { type: String, required: false },
    scheduleStartTime : { type: String, required: false },
    scheduleEndTime : { type: String, required: false },
    scheduleSlot : { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleSlot", required: false },
}, { timestamps: true });

WorkSchema.index({ client: 1, _id: -1 });
WorkSchema.index({ worker: 1, _id: -1 });
WorkSchema.index({ scheduledDate: 1 });

export default mongoose.model('Works', WorkSchema)
