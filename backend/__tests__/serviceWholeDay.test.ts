import mongoose from "mongoose";
import { WorkScheduleService } from "../services/workSchedule.service";
import { ServiceRequestController } from "../controller/serviceRequest.controller";
import { DEFAULT_WORK_SCHEDULE } from "../types/barangaySettings.type";
import AccountModel from "../model/account.model";
import ServiceRequestModel from "../model/serviceRequest.model";

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const nextWorkingDay = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return dateKey(d);
};

const SLOT_COUNT = DEFAULT_WORK_SCHEDULE.slots.length;
const SLOT_STARTS = DEFAULT_WORK_SCHEDULE.slots.map((s) => s.startTime);

async function seedProvider() {
  return AccountModel.create({
    name: "Provider One",
    email: "provider@example.com",
    contact: "09171111111",
    password: "x",
    status: "approved",
    role: "resident",
    availability: "AVAILABLE",
    skills: [
      {
        skill: "Plumbing",
        experience: 2,
        proficiency: "High",
        serviceTypes: ["Fix leak"],
        availability: "available",
      },
    ],
  });
}

async function seedClient() {
  return AccountModel.create({
    name: "Client One",
    email: "client@example.com",
    contact: "09172222222",
    password: "x",
    status: "approved",
    role: "resident",
  });
}

function makeReq(account: any, body: Record<string, unknown>, params: Record<string, string> = {}) {
  return { account, body, params } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("service contract whole day", () => {
  it("reserves and releases every configured slot for a day", async () => {
    const provider = new mongoose.Types.ObjectId().toString();
    const date = nextWorkingDay();

    const day = await WorkScheduleService.reserveDay(provider, date);
    expect(day.slots.length).toBe(SLOT_COUNT);
    expect(day.startTime).toBe(SLOT_STARTS[0]);
    expect(day.endTime).toBe(DEFAULT_WORK_SCHEDULE.slots[SLOT_COUNT - 1].endTime);

    const full = await WorkScheduleService.getAvailability(provider, date, "AVAILABLE");
    expect(full.slots.every((s) => s.status === "full")).toBe(true);

    await WorkScheduleService.releaseMany(day.slots.map((s: any) => s._id));
    const open = await WorkScheduleService.getAvailability(provider, date, "AVAILABLE");
    expect(open.slots.every((s) => s.status === "available")).toBe(true);
  });

  it("creates a whole-day service request holding all slots", async () => {
    const provider = await seedProvider();
    const client = await seedClient();
    const date = nextWorkingDay();

    const res = makeRes();
    await ServiceRequestController.create(
      makeReq(client, {
        provider: provider._id.toString(),
        skill: "Plumbing",
        serviceType: "Fix leak",
        description: "Fix the whole plumbing",
        location: "Purok 1",
        scheduledDate: date,
        wholeDay: true,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const created = await ServiceRequestModel.findOne({ provider: provider._id });
    expect(created!.wholeDay).toBe(true);
    expect(created!.scheduleSlots!.length).toBe(SLOT_COUNT);
    expect(created!.preferredTime).toBe("Whole day");

    const avail = await WorkScheduleService.getAvailability(provider._id.toString(), date, "AVAILABLE");
    expect(avail.slots.every((s) => s.status === "full")).toBe(true);
  });

  it("releases every slot when the provider rejects the request", async () => {
    const provider = await seedProvider();
    const client = await seedClient();
    const date = nextWorkingDay();

    await ServiceRequestController.create(
      makeReq(client, {
        provider: provider._id.toString(),
        skill: "Plumbing",
        serviceType: "Fix leak",
        description: "Fix the whole plumbing",
        location: "Purok 1",
        scheduledDate: date,
        wholeDay: true,
      }),
      makeRes(),
    );
    const created = await ServiceRequestModel.findOne({ provider: provider._id });

    const res = makeRes();
    await ServiceRequestController.reject(
      makeReq(provider, {}, { id: created!._id.toString() }),
      res,
    );

    const avail = await WorkScheduleService.getAvailability(provider._id.toString(), date, "AVAILABLE");
    expect(avail.slots.every((s) => s.status === "available")).toBe(true);
  });

  it("rolls back partial reservations when the day cannot be fully reserved", async () => {
    const provider = await seedProvider();
    const client = await seedClient();
    const date = nextWorkingDay();

    await WorkScheduleService.reserve(provider._id.toString(), date, "13:00");

    const res = makeRes();
    await ServiceRequestController.create(
      makeReq(client, {
        provider: provider._id.toString(),
        skill: "Plumbing",
        serviceType: "Fix leak",
        description: "Fix the whole plumbing",
        location: "Purok 1",
        scheduledDate: date,
        wholeDay: true,
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(await ServiceRequestModel.countDocuments({ provider: provider._id })).toBe(0);

    const avail = await WorkScheduleService.getAvailability(provider._id.toString(), date, "AVAILABLE");
    const morning = avail.slots.filter((s) => ["09:00", "10:00"].includes(s.startTime));
    expect(morning.every((s) => s.status === "available")).toBe(true);
  });
});
