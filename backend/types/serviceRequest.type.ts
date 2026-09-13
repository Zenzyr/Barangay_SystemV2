export type ServiceRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface serviceRequestInterfaceInput {
  client: string;
  provider: string;
  skill: string;
  serviceType: string;
  description: string;
  preferredDate?: string;
  preferredTime?: string;
  location: string;
  budget?: number;
  notes?: string;
  status?: ServiceRequestStatus;
}

export interface serviceRequestInterface extends serviceRequestInterfaceInput {
  _id: string;
}
