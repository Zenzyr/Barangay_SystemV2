import { accountInterface } from "./account.type";

export interface workInterfaceInput {
      client : string,
      worker : string,
      status : string,
      service : string,
      description : string,
      date : string,
}

export interface workInterface {
    _id : string,
     client : accountInterface,
      worker : accountInterface,
      status : string,
      service : string,
      description : string,
      date : string,
   
}

export type WorkRequestKind = "booking" | "service";

export interface WorkRequestParty {
  _id: string;
  name: string;
  profile: string;
  email: string;
  contact: string;
  address: string;
  purok: string;
}

export interface WorkRequestItem {
  _id: string;
  kind: WorkRequestKind;
  category: string;
  title: string;
  description: string;
  status: string;
  client: WorkRequestParty | null;
  provider: WorkRequestParty | null;
  scheduledDate: string | null;
  scheduleStartTime: string | null;
  scheduleEndTime: string | null;
  scheduleLabel: string | null;
  location: string;
  budget: number | null;
  notes: string;
  createdAt: string;
}

export type SlotStatus = "available" | "full" | "past";

export interface SlotAvailability {
  startTime: string;
  endTime: string;
  label: string;
  capacity: number;
  booked: number;
  remaining: number;
  status: SlotStatus;
}

export interface DayAvailability {
  provider: string;
  date: string;
  open: boolean;
  closedReason: string | null;
  slots: SlotAvailability[];
}
