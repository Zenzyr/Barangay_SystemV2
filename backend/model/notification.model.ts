import mongoose, { Schema } from 'mongoose';

const NotificationSchema = new Schema({
    accountId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, required: true, default: 'system' },
    read: { type: Boolean, required: true, default: false },
    createdAt: { type: Date, required: true, default: Date.now },
});

export default mongoose.model('Notification', NotificationSchema)