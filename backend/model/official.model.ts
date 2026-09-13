import mongoose, { Schema } from 'mongoose';
import { SINGLE_HOLDER_POSITIONS } from '../types/official.type';

const OfficialSchema = new Schema<{
  fullName: string;
  position: string;
  status: 'active' | 'inactive';
  precedence: number;
  termStart?: string;
  termEnd?: string;
  termLabel?: string;
  signatureImage?: string;
  photo?: string;
  contact?: string;
  notes?: string;
}>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    position: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'inactive',
    },
    precedence: { type: Number, default: 0 },
    termStart: { type: String, trim: true, maxlength: 20, default: '' },
    termEnd: { type: String, trim: true, maxlength: 20, default: '' },
    termLabel: { type: String, trim: true, maxlength: 50, default: '' },
    signatureImage: { type: String, default: '' },
    photo: { type: String, default: '' },
    contact: { type: String, trim: true, maxlength: 30, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

// Prevent more than one ACTIVE holder per position for positions that are
// single-holder. Enforcement is also done in the service layer (with the
// automatic deactivation flow), this index is a second line of defense.
OfficialSchema.index(
  { position: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      position: { $in: SINGLE_HOLDER_POSITIONS },
      status: 'active',
    },
  }
);

export default mongoose.model('Officials', OfficialSchema);