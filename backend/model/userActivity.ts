import mongoose, { Schema } from 'mongoose';


const UserActivitychema = new Schema({
    accountId : { type: String, required: true },
    activity: { type: String, required: true },
    date : { type: String, required: true },
});

export default mongoose.model('UserActivity', UserActivitychema)