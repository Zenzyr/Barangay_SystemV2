import mongoose, { Schema } from 'mongoose';

const ReviewSchema = new Schema({
    contract: { type: Schema.Types.ObjectId, ref: "Contract", required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: "Accounts", required: true },
    provider: { type: Schema.Types.ObjectId, ref: "Accounts", required: true },
    skill: { type: String, required: true },
    star: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("Review", ReviewSchema);
