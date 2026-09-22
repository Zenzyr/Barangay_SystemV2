export type AuditEntity = "official" | "barangaySettings" | "account" | "decisionSupport" | "residentCensus" | "analyticsSnapshot";

export interface auditLogInterfaceInput {
  /** Display identity of the actor (from the authenticated account). */
  actor: string;
  actorId?: string;
  action: string;
  entity: AuditEntity;
  entityId: string;
  /** Human readable label of the record that changed. */
  entityLabel: string;
  field?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

export interface auditLogInterface extends auditLogInterfaceInput {
  _id: string;
  createdAt: string;
}