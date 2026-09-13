import mongoose, { Schema, Document } from 'mongoose';

export interface ICertificateTemplate extends Document {
  name: string;
  documentType: string;
  status: 'active' | 'inactive';
  isDefault: boolean;
  version: number;
  layoutConfig: Record<string, any>; // Complex JSON structure for the UI to edit
  signatoryConfig: Record<string, { name: string; position: string; signatureImage?: string }>; // NEW FIELD
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CertificateTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    documentType: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isDefault: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    layoutConfig: { type: Schema.Types.Mixed, required: true },
    signatoryConfig: { type: Schema.Types.Mixed, default: {} }, // NEW FIELD
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Accounts' },
  },
  { timestamps: true }
);

export default mongoose.model<ICertificateTemplate>('CertificateTemplate', CertificateTemplateSchema);
