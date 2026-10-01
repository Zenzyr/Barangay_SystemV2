import mongoose from "mongoose";
import WorkModel from "../model/work.model";
import ServiceRequestModel from "../model/serviceRequest.model";
import { ScheduleError, WorkScheduleService, formatSlotLabel } from "./workSchedule.service";
import { NotificationService } from "./notification.service";

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

export interface WorkRequestView {
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

export interface WorkRequestFilter {
  participant?: string;
  role?: "client" | "provider" | "any";
  status?: string;
  kind?: WorkRequestKind;
  from?: string;
  to?: string;
  dateField?: "scheduled" | "created";
  search?: string;
}

const PARTY_FIELDS = "name profile email contact address purok";
const OPEN_STATUSES = ["pending", "active", "accepted", "to review"];

const party = (value: any): WorkRequestParty | null => {
  if (!value || typeof value !== "object" || !value._id) return null;
  return {
    _id: String(value._id),
    name: value.name || "",
    profile: value.profile || "",
    email: value.email || "",
    contact: value.contact || "",
    address: value.address || "",
    purok: value.purok || "",
  };
};

const createdAtOf = (doc: any): string => {
  if (doc.createdAt) return new Date(doc.createdAt).toISOString();
  return new mongoose.Types.ObjectId(String(doc._id)).getTimestamp().toISOString();
};

const scheduleOf = (doc: any) => {
  const hasSchedule = !!(doc.scheduledDate && doc.scheduleStartTime && doc.scheduleEndTime);
  return {
    scheduledDate: hasSchedule ? doc.scheduledDate : null,
    scheduleStartTime: hasSchedule ? doc.scheduleStartTime : null,
    scheduleEndTime: hasSchedule ? doc.scheduleEndTime : null,
    scheduleLabel: hasSchedule ? formatSlotLabel(doc.scheduleStartTime, doc.scheduleEndTime) : null,
  };
};

const splitService = (service: string, skill?: string) => {
  if (skill) {
    const prefix = `${skill} - `;
    return { category: skill, title: service.startsWith(prefix) ? service.slice(prefix.length) : service };
  }
  const idx = service.indexOf(" - ");
  if (idx > 0) return { category: service.slice(0, idx), title: service.slice(idx + 3) };
  return { category: service, title: service };
};

export const toWorkRequestViewFromWork = (doc: any): WorkRequestView => {
  const { category, title } = splitService(String(doc.service || ""), doc.skill);
  return {
    _id: String(doc._id),
    kind: "booking",
    category,
    title,
    description: doc.description || "",
    status: String(doc.status || "pending").toLowerCase(),
    client: party(doc.client),
    provider: party(doc.worker),
    ...scheduleOf(doc),
    location: doc.client?.address || "",
    budget: null,
    notes: "",
    createdAt: createdAtOf(doc),
  };
};

export const toWorkRequestViewFromService = (doc: any): WorkRequestView => ({
  _id: String(doc._id),
  kind: "service",
  category: doc.skill || "",
  title: doc.serviceType || "",
  description: doc.description || "",
  status: String(doc.status || "PENDING").toLowerCase(),
  client: party(doc.client),
  provider: party(doc.provider),
  ...scheduleOf(doc),
  location: doc.location || "",
  budget: typeof doc.budget === "number" ? doc.budget : null,
  notes: doc.notes || "",
  createdAt: createdAtOf(doc),
});

const statusQuery = (kind: WorkRequestKind, status?: string) => {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (kind === "booking") return s;
  return s.toUpperCase();
};

export class WorkRequestService {

  static async list(filter: WorkRequestFilter = {}): Promise<WorkRequestView[]> {
    const workQuery: Record<string, any> = {};
    const serviceQuery: Record<string, any> = {};

    if (filter.participant) {
      const id = filter.participant;
      const role = filter.role || "any";
      if (role === "client") {
        workQuery.client = id;
        serviceQuery.client = id;
      } else if (role === "provider") {
        workQuery.worker = id;
        serviceQuery.provider = id;
      } else {
        workQuery.$or = [{ client: id }, { worker: id }];
        serviceQuery.$or = [{ client: id }, { provider: id }];
      }
    }

    if (filter.status) {
      workQuery.status = statusQuery("booking", filter.status);
      serviceQuery.status = statusQuery("service", filter.status);
    }

    if ((filter.from || filter.to) && filter.dateField === "created") {
      const range: Record<string, mongoose.Types.ObjectId> = {};
      if (filter.from) range.$gte = mongoose.Types.ObjectId.createFromTime(Math.floor(new Date(`${filter.from}T00:00:00`).getTime() / 1000));
      if (filter.to) {
        const end = new Date(`${filter.to}T00:00:00`);
        end.setDate(end.getDate() + 1);
        range.$lt = mongoose.Types.ObjectId.createFromTime(Math.floor(end.getTime() / 1000));
      }
      workQuery._id = range;
      serviceQuery._id = range;
    } else if (filter.from || filter.to) {
      const range: Record<string, string> = {};
      if (filter.from) range.$gte = filter.from;
      if (filter.to) range.$lte = filter.to;
      workQuery.scheduledDate = range;
      serviceQuery.scheduledDate = range;
    }

    const [works, services] = await Promise.all([
      filter.kind === "service"
        ? Promise.resolve([])
        : WorkModel.find(workQuery)
            .populate("client", PARTY_FIELDS)
            .populate("worker", PARTY_FIELDS)
            .sort({ _id: -1 })
            .lean(),
      filter.kind === "booking"
        ? Promise.resolve([])
        : ServiceRequestModel.find(serviceQuery)
            .populate("client", PARTY_FIELDS)
            .populate("provider", PARTY_FIELDS)
            .sort({ createdAt: -1 })
            .lean(),
    ]);

    let items = [
      ...works.map(toWorkRequestViewFromWork),
      ...services.map(toWorkRequestViewFromService),
    ];

    const q = filter.search?.trim().toLowerCase();
    if (q) {
      items = items.filter((item) =>
        [item.title, item.category, item.description, item.client?.name, item.provider?.name, item.location]
          .some((v) => (v || "").toLowerCase().includes(q)),
      );
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items;
  }

  static async getRecord(kind: WorkRequestKind, id: string) {
    if (kind === "booking") {
      return WorkModel.findById(id).populate("client", PARTY_FIELDS).populate("worker", PARTY_FIELDS);
    }
    return ServiceRequestModel.findById(id).populate("client", PARTY_FIELDS).populate("provider", PARTY_FIELDS);
  }

  static async reschedule(kind: WorkRequestKind, id: string, date: unknown, startTime: unknown) {
    const record: any = await this.getRecord(kind, id);
    if (!record) throw new ScheduleError("Work request not found", 404, "NOT_FOUND");

    const view = kind === "booking" ? toWorkRequestViewFromWork(record.toObject()) : toWorkRequestViewFromService(record.toObject());
    if (!OPEN_STATUSES.includes(view.status)) {
      throw new ScheduleError(`A ${view.status} work request can no longer be rescheduled`, 400, "INVALID_STATUS");
    }
    if (view.scheduledDate === date && view.scheduleStartTime === startTime) {
      throw new ScheduleError("The work request is already scheduled for this slot", 400, "SAME_SLOT");
    }

    const providerId = view.provider?._id;
    if (!providerId) throw new ScheduleError("The provider for this request no longer exists", 400, "NO_PROVIDER");

    const newSlot = await WorkScheduleService.reserve(providerId, date, startTime);
    const previousSlot = record.scheduleSlot ? String(record.scheduleSlot) : null;

    const Model: any = kind === "booking" ? WorkModel : ServiceRequestModel;
    const guard: Record<string, any> = { _id: id, scheduleSlot: previousSlot ?? null };

    const update: Record<string, any> = {
      scheduledDate: newSlot.date,
      scheduleStartTime: newSlot.startTime,
      scheduleEndTime: newSlot.endTime,
      scheduleSlot: newSlot._id,
    };
    if (kind === "service") {
      update.preferredDate = newSlot.date;
      update.preferredTime = formatSlotLabel(newSlot.startTime, newSlot.endTime);
    }

    const updated = await Model.findOneAndUpdate(guard, { $set: update }, { new: true })
      .populate("client", PARTY_FIELDS)
      .populate(kind === "booking" ? "worker" : "provider", PARTY_FIELDS);

    if (!updated) {
      await WorkScheduleService.release(newSlot._id);
      throw new ScheduleError("This work request was changed by someone else. Please reload and try again.", 409, "CONFLICT");
    }

    if (previousSlot) await WorkScheduleService.release(previousSlot);

    const result = kind === "booking" ? toWorkRequestViewFromWork(updated.toObject()) : toWorkRequestViewFromService(updated.toObject());
    const when = `${new Date(`${result.scheduledDate}T00:00:00`).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}, ${result.scheduleLabel}`;

    for (const target of [result.client, result.provider]) {
      if (!target?._id) continue;
      await NotificationService.create({
        accountId: target._id,
        title: "Work Request Rescheduled",
        message: `The work request "${result.title}" has been rescheduled by the barangay to ${when}.`,
        type: "work",
      }).catch(() => null);
    }

    return result;
  }
}
