import mongoose, { Schema } from 'mongoose';

const EVENT_STATUSES = ["upcoming", "completed", "cancelled"];

const EventSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: false },
    category: { type: String, required: false },
    date: { type: Date, required: true },
    startTime: { type: String, required: false },
    endTime: { type: String, required: false },
    location: { type: String, required: false },
    organizer: { type: String, required: false },
    status: { type: String, enum: EVENT_STATUSES, default: "upcoming" },
    maxParticipants: { type: Number, required: false, min: 0 },
    // Accounts that registered/attended (optional, lightweight).
    attendees: { type: [mongoose.Schema.Types.ObjectId], ref: "Accounts", default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: false },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, required: false },
}, { timestamps: true });

export default mongoose.model('Event', EventSchema)