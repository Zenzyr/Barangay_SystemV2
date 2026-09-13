export interface reviewInterfaceInput {
  contract: string;
  client: string;
  provider: string;
  skill: string;
  star: number;
  message: string;
}

export interface reviewInterface extends reviewInterfaceInput {
  _id: string;
}
