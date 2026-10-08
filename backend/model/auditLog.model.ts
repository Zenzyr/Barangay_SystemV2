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
    // Do NOT reintroduce an enum here: it silently rejected workRequest/contract
    // writes for months (every failure was swallowed by .catch(() => null)).
    entity: { type: String, required: true, maxlength: 60 },
    entityId: { type: String, default: '' },
    entityLabel: { type: String, default: '' },
    field: { type: String, default: '' },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The history screen sorts by createdAt (optionally scoped to an entity) and
// is the hottest query against a collection that only ever grows.
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entity: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model('AuditLogs', AuditLogSchema);