export interface residentCensusInterfaceInput {
  name: string;
  sex: string;
  birthday: string;
  age: number | string;
  occupation: string;
  education: string;
  purok: string;
  householdNumber: string;
  is4Ps: string;
  soloParent: string;
  familyPlanning: string;
  isSenior: string;
  hpnMaintenance: string;
  pensioner: string;
  isPWD: string;
  cellphone: string;
}

export interface residentCensusInterface extends residentCensusInterfaceInput {
  _id: string;
}
