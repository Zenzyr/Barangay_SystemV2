import mongoose, { Schema } from 'mongoose';


const BusinessSchema = new Schema({
    resident: { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: true },
    businessName : { type: String, required: true },
    document : { type: String, required: false, default: '' },
    type : { type: String, required: true },
    businessInfo : { type: String, required: true },
    address : { type: String, required: true },
    logo : { type: String, required: true },
    images : [{ type: String, required: true }],
    status : { type: String, required: true },
});

export default mongoose.model('Business', BusinessSchema)