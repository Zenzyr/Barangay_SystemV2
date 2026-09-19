import mongoose, { Schema } from 'mongoose';

const BackupMetadataSchema = new Schema(
  {
    filename: { type: String, required: true, unique: true },
    sizeBytes: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['completed', 'failed'], required: true, default: 'completed' },
    collections: [{
      name: { type: String, required: true },
      count: { type: Number, required: true, default: 0 },
    }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'Accounts', required: false },
    createdByName: { type: String, default: '' },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('BackupMetadata', BackupMetadataSchema);
