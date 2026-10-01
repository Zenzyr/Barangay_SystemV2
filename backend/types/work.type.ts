import { accountInterface } from "./accounts.type";

export interface workInterfaceInput {
      client : string,
      worker : string,
      status : string,
      service : string,
      description : string,
      date : string,
      skill? : string,
      scheduledDate? : string,
      scheduleStartTime? : string,
      scheduleEndTime? : string,
      scheduleSlot? : string,
}

export interface workInterface {
    _id : string,
     client : accountInterface,
      worker : accountInterface,
      status : string,
      service : string,
      description : string,
      date : string,
      skill? : string,
      scheduledDate? : string,
      scheduleStartTime? : string,
      scheduleEndTime? : string,
      scheduleSlot? : string,
}
