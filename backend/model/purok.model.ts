import mongoose, { Schema } from 'mongoose';

const PurokSchema = new Schema<{
  name: string;
  status: 'active' | 'inactive';
  description?: string;
  leader?: string;
  contact?: string;
}>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    leader: { type: String, trim: true, maxlength: 150, default: '' },
    contact: { type: String, trim: true, maxlength: 30, default: '' },
  },
  { timestamps: true }
);

PurokSchema.index({ name: 1 }, { unique: true });

export default mongoose.model('Puroks', PurokSchema);