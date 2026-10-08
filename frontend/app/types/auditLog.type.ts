export interface auditLog {
  _id: string;
  actor: string;
  actorId?: string;
  action: string;
  entity: "official" | "barangaySettings" | "account" | "decisionSupport" | "residentCensus" | "analyticsSnapshot" | "documentTemplate" | "workRequest" | "contract" | "backup" | "business" | "documentRequest" | "transaction" | "purok" | "certificate";
  entityId: string;
  entityLabel: string;
  field?: string;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}