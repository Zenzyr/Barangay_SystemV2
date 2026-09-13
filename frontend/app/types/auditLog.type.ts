export interface auditLog {
  _id: string;
  actor: string;
  actorId?: string;
  action: string;
  entity: "official" | "barangaySettings" | "account";
  entityId: string;
  entityLabel: string;
  field?: string;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt: string;
}