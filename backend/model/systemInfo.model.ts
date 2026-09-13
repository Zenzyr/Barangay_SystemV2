import mongoose, { Schema } from 'mongoose';


const SystemInfoSchema = new Schema({
    aiContext: { type: String, required: true },
});

export default mongoose.model('SystemInfos', SystemInfoSchema)