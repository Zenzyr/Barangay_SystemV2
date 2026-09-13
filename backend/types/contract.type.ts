export type ContractStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETION_REQUESTED"
  | "COMPLETED"
  | "CANCELLED";

export interface contractInterfaceInput {
  serviceRequest: string;
  client: string;
  provider: string;
  skill: string;
  serviceType: string;
  description: string;
  agreedPrice?: number | null;
  startDate?: string | null;
  expectedEndDate?: string | null;
  location: string;
  notes?: string | null;
  status?: ContractStatus;
}

export interface contractInterface extends contractInterfaceInput {
  _id: string;
}