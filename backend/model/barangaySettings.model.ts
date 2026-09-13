import mongoose, { Schema } from 'mongoose';
import { DEFAULT_BARANGAY_SETTINGS, barangaySettingsInterfaceInput } from '../types/barangaySettings.type';

const barangayInfoSubSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 150, default: '' },
    municipality: { type: String, trim: true, maxlength: 150, default: '' },
    province: { type: String, trim: true, maxlength: 150, default: '' },
    region: { type: String, trim: true, maxlength: 150, default: '' },
    address: { type: String, trim: true, maxlength: 255, default: '' },
    contactNumber: { type: String, trim: true, maxlength: 30, default: '' },
    email: { type: String, trim: true, maxlength: 254, default: '' },
    logoUrl: { type: String, default: '' },
    sealUrl: { type: String, default: '' },
    headerText: { type: String, trim: true, maxlength: 500, default: '' },
    footerText: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false }
);

const documentSettingsSubSchema = new Schema(
  {
    headerText: { type: String, trim: true, maxlength: 500, default: '' },
    footerText: { type: String, trim: true, maxlength: 1000, default: '' },
    logoUrl: { type: String, default: '' },
    sealUrl: { type: String, default: '' },
    certificateNumberFormat: { type: String, trim: true, maxlength: 100, default: '' },
    signatoryTitle: { type: String, trim: true, maxlength: 100, default: 'Punong Barangay' },
    signaturePositions: [{ type: String }],
    // Refactored to per-template config
    templates: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const externalRecipientSubSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 100, default: '' },
    name: { type: String, trim: true, maxlength: 200, default: '' },
    position: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { _id: false }
);

const smsSettingsSubSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    senderName: { type: String, trim: true, maxlength: 60, default: '' },
    provider: { type: String, trim: true, maxlength: 60, default: 'Semaphore' },
    notifyOnRequest: { type: Boolean, default: true },
    notifyOnStatus: { type: Boolean, default: true },
    notifyOnPayment: { type: Boolean, default: true },
  },
  { _id: false }
);

const BarangaySettingsSchema = new Schema<barangaySettingsInterfaceInput & { _id: mongoose.Types.ObjectId }>(
  {
    barangay: { type: barangayInfoSubSchema, default: DEFAULT_BARANGAY_SETTINGS.barangay },
    documents: { type: documentSettingsSubSchema, default: DEFAULT_BARANGAY_SETTINGS.documents },
    externalRecipients: { type: [externalRecipientSubSchema], default: DEFAULT_BARANGAY_SETTINGS.externalRecipients },
    sms: { type: smsSettingsSubSchema, default: DEFAULT_BARANGAY_SETTINGS.sms },
  },
  { timestamps: true }
);

export default mongoose.model('BarangaySettings', BarangaySettingsSchema);