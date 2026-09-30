import mongoose, { Schema } from 'mongoose';
import { AuditEntity } from '../types/auditLog.type';

const AuditLogSchema = new Schema<{
  actor: string;
  actorId?: string;
  action: string;
  entity: AuditEntity;
  entityId: string;
  entityLabel: string;
  field?: string;
  previousValue?: unknown;
  newValue?: unknown;
}>(
  {
    actor: { type: String, required: true, maxlength: 150 },
    actorId: { type: String, default: '' },
    action: { type: String, required: true, maxlength: 100 },
    // Purposely a free string so the history endpoint can filter uniformly.
    entity: { type: String, enum: ['official', 'barangaySettings', 'account', 'decisionSupport', 'residentCensus', 'analyticsSnapshot'] },
    entityId: { type: String, default: '' },
    entityLabel: { type: String, default: '' },
    field: { type: String, default: '' },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('AuditLogs', AuditLogSchema);