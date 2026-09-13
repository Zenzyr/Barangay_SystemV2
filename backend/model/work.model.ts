import mongoose, { Schema } from 'mongoose';


const WorkSchema = new Schema({
    client : { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: true },
    worker : { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: true },
    status : { type: String, required: true },
    service : { type: String, required: true },
    description : { type: String, required: true },
    date : { type: String, required: true },
});

export default mongoose.model('Works', WorkSchema)