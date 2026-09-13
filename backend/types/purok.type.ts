export interface purokInterfaceInput {
  name: string;
  status: "active" | "inactive";
  description?: string;
  leader?: string;
  contact?: string;
}

export interface purokInterface extends purokInterfaceInput {
  _id: string;
  createdAt: string;
  updatedAt: string;
}