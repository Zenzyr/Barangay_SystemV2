export interface purokInterface {
  _id: string;
  name: string;
  status: "active" | "inactive";
  description?: string;
  leader?: string;
  contact?: string;
  createdAt: string;
  updatedAt: string;
}

export interface purokInput {
  name: string;
  status: "active" | "inactive";
  description?: string;
  leader?: string;
  contact?: string;
}