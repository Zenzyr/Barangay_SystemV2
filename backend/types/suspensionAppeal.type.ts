export type SuspensionAppealStatus = "pending" | "under_review" | "approved" | "rejected";

export interface suspensionAppealInterfaceInput {
  accountId: string;
  reason: string;
  status?: SuspensionAppealStatus;
  reviewedBy?: string;
  reviewedAt?: Date;
  decisionNote?: string;
}

export interface suspensionAppealInterface extends suspensionAppealInterfaceInput {
  _id: string;
  createdAt: string;
  updatedAt: string;
}
