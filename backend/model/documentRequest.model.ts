import mongoose, { Schema } from 'mongoose';


const DOCUMENT_TYPES = [
  "barangayCertificate",
  "certificateOfResidency",
  "certificateOfIndigency",
  "certificateOfGoodMoralCharacter",
  "certificateOfUnemployment",
  "barangayBusinessClearance",
  "certificateOfAttestation",
  "certificationOfTreesCutting",
  "barangayCertification",
  "certificateOfFirstTimeJobseeker",
  "firstTimeJobseekerOath",
  "certificateOfLowIncome",
  "endorsementLetter",
];

// Primary lifecycle: pending -> processing -> ready -> released (or cancelled
// at any open stage). Legacy statuses ("to claim", "completed", "rejected")
// are kept for backward compatibility with existing records and transition
// into the primary set on their next status update.
const DOCUMENT_STATUSES = [
  "pending",
  "processing",
  "ready",
  "released",
  "cancelled",
  "to claim",
  "completed",
  "rejected",
];

const DocumentSchema = new Schema({
    // Optional: linked to an Accounts doc when the resident has an account.
    // Walk-ins without an account are stored via the denormalized snapshot
    // fields (fullName, contact, address, dateOfBirth, ...) instead.
    resident: { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: false },
    document: { type: String, required: true, enum: DOCUMENT_TYPES },
    status: { type: String, required: true, enum: DOCUMENT_STATUSES, default: "pending" },
    isPaid : { type: Boolean, required: true, default: false },
    price : { type: Number, required: true, min: 0 },

    // ── Template tracking ──────────────────────────────────────────
    // Links this request to the exact document template that produced it,
    // with a frozen fee snapshot so the charge is stable even if the
    // template fee is later changed.
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "DocumentTemplate", required: false },
    templateVersion: { type: Number, required: false },
    feeAtRequest: { type: Number, required: false },

    fullName : { type: String, required: false },
    contact: { type: String, required: false },
    address: { type: String, required: false },
    dateOfBirth: { type: String, required: false },
    civilStatus: { type: String, required: false },
    nationality: { type: String, required: false }, 
    occupation: { type: String, required: false },
    yrsOfResidency: { type: Number, required: false },
    
    purpose : { type: String, required: false },
    documentNumber : { type: String, required: false },
    dateIssued : { type: String, required: false },

    businessName : { type: String, required: false },
    businessAddress : { type: String, required: false },
    businessType : { type: String, required: false },
    businessNature : { type: String, required: false },

    workStatus : { type: String, required: false },
    workplace : { type: String, required: false },
    monthlyIncome : { type: String, required: false },
    expenseType : { type: String, required: false },
    householdExpenses : { type: String, required: false },
    assistanceTo : { type: String, required: false },
    titleNo : { type: String, required: false },
    taxDeclarationNo : { type: String, required: false },
    landArea : { type: String, required: false },
    treeCount : { type: String, required: false },
    treeType : { type: String, required: false },
    age : { type: String, required: false },
    spouseName : { type: String, required: false },
    annualIncome : { type: String, required: false },
    purok : { type: String, required: false },

    // ✅ Normalized duplicate-prevention key (Asia/Manila). requestDate + requestTime
    // are derived from the single request timestamp at creation time and used for
    // the duplicate check and the partial unique index (race-condition protection).
    requestDate : { type: String, required: false },
    requestTime : { type: String, required: false },
    // "online" = resident requested in-app; "walk-in" = secretary filed on behalf.
    source : { type: String, enum: ["online", "walk-in"], default: "online" },
    // Soft-delete/archive for completed records so history/audit is preserved.
    isArchived : { type: Boolean, default: false },
    archivedAt : { type: Date, required: false },
    // Full audit trail of status changes for the "View History" action.
    statusHistory : [{
        status : { type: String, required: true },
        at : { type: Date, default: Date.now },
    }],

    // Snapshot of the officials + settings used at the time the document was
    // finalized. Preserves historical documents when leadership changes.
    officialsSnapshot : { type: Schema.Types.Mixed, required: false },
    checkoutSessionId: { type: String, required: false },

   
});

// Race-condition protection for duplicate requests: only one request per
// resident + document type + date + time may exist. Partial index keeps the
// constraint scoped to records that actually carry the normalized stamp and
// a linked account, so legacy documents and walk-ins without an account
// (resident = null) are unaffected.
DocumentSchema.index(
  { resident: 1, document: 1, requestDate: 1, requestTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      "resident": { $type: "objectId" },
      "requestDate": { $type: "string" },
      "requestTime": { $type: "string" },
    },
  }
);

export default mongoose.model('Documents', DocumentSchema)