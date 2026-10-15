import mongoose from "mongoose";
import { WorkScheduleService } from "../services/workSchedule.service";
import { ContractService } from "../services/contract.service";
import { AccountController } from "../controller/accounts.controller";
import ContractModel from "../model/contract.model";
import AccountModel from "../model/account.model";
import WorkModel from "../model/work.model";

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const nextWorkingDay = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return dateKey(d);
};

const otherWorkingDay = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return dateKey(d);
};

async function seedWorker(availability = "BUSY") {
  return AccountModel.create({
    name: "Worker One",
    email: "worker@example.com",
    contact: "09170000001",
    password: "x",
    status: "approved",
    role: "resident",
    availability,
    skills: [
      {
        skill: "Plumbing",
        experience: 3,
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
    contact: "09170000002",
    password: "x",
    status: "approved",
    role: "resident",
  });
}

function makeReq(account: any, body: Record<string, unknown>) {
  return { account, body } as any;
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("busy provider contract-date blocking", () => {
  it("marks the active contract date as closed when the provider is BUSY", async () => {
    const provider = new mongoose.Types.ObjectId().toString();
    const now = new Date();
    const contractDate = nextWorkingDay();
    const openDate = otherWorkingDay();

    const closed = await WorkScheduleService.getAvailability(provider, contractDate, "BUSY", now, [contractDate]);
    expect(closed.open).toBe(false);
    expect(closed.closedReason).toMatch(/service contract/i);

    const open = await WorkScheduleService.getAvailability(provider, openDate, "BUSY", now, [contractDate]);
    expect(open.open).toBe(true);
    expect(open.slots.length).toBeGreaterThan(0);
  });

  it("still blocks the current day for a BUSY provider", async () => {
    const provider = new mongoose.Types.ObjectId().toString();
    const now = new Date();
    const today = dateKey(now);

    const result = await WorkScheduleService.getAvailability(provider, today, "BUSY", now, []);
    expect(result.open).toBe(false);
    expect(result.closedReason).toMatch(/busy today/i);
  });

  it("ignores busy dates when the provider is AVAILABLE", async () => {
    const provider = new mongoose.Types.ObjectId().toString();
    const now = new Date();
    const contractDate = nextWorkingDay();

    const result = await WorkScheduleService.getAvailability(provider, contractDate, "AVAILABLE", now, [contractDate]);
    expect(result.open).toBe(true);
  });

  it("returns only the open active contract for a provider", async () => {
    const worker = await seedWorker("BUSY");
    const client = await seedClient();
    const startDate = nextWorkingDay();
    const serviceRequestId = new mongoose.Types.ObjectId();

    await ContractModel.create({
      serviceRequest: new mongoose.Types.ObjectId(),
      client: client._id,
      provider: worker._id,
      skill: "Plumbing",
      serviceType: "Fix leak",
      description: "Leaky pipe",
      location: "Purok 1",
      status: "COMPLETED",
      startDate: "2020-01-01",
    });
    const active = await ContractModel.create({
      serviceRequest: serviceRequestId,
      client: client._id,
      provider: worker._id,
      skill: "Plumbing",
      serviceType: "Fix leak",
      description: "Leaky pipe",
      location: "Purok 1",
      status: "ACTIVE",
      startDate,
    });

    const found = await ContractService.getActiveByProvider(worker._id.toString());
    expect(found).toBeTruthy();
    expect(found!.startDate).toBe(startDate);
    expect(found!._id.toString()).toBe(active._id.toString());
  });

  it("rejects a Quick Booking on the provider's contract date", async () => {
    const worker = await seedWorker("BUSY");
    const client = await seedClient();
    const contractDate = nextWorkingDay();

    await ContractModel.create({
      serviceRequest: new mongoose.Types.ObjectId(),
      client: client._id,
      provider: worker._id,
      skill: "Plumbing",
      serviceType: "Fix leak",
      description: "Leaky pipe",
      location: "Purok 1",
      status: "ACTIVE",
      startDate: contractDate,
    });

    const res = makeRes();
    await AccountController.bookWork(
      makeReq(client, {
        worker: worker._id.toString(),
        skill: "Plumbing",
        service: "Fix leak",
        description: "Please fix my sink",
        scheduledDate: contractDate,
        startTime: "09:00",
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.stringMatching(/busy/i));
    expect(await WorkModel.countDocuments({ worker: worker._id })).toBe(0);
  });

  it("allows a Quick Booking on a different date for a BUSY provider", async () => {
    const worker = await seedWorker("BUSY");
    const client = await seedClient();
    const contractDate = nextWorkingDay();
    const bookDate = otherWorkingDay();

    await ContractModel.create({
      serviceRequest: new mongoose.Types.ObjectId(),
      client: client._id,
      provider: worker._id,
      skill: "Plumbing",
      serviceType: "Fix leak",
      description: "Leaky pipe",
      location: "Purok 1",
      status: "ACTIVE",
      startDate: contractDate,
    });

    const res = makeRes();
    await AccountController.bookWork(
      makeReq(client, {
        worker: worker._id.toString(),
        skill: "Plumbing",
        service: "Fix leak",
        description: "Please fix my sink",
        scheduledDate: bookDate,
        startTime: "09:00",
      }),
      res,
    );

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(await WorkModel.countDocuments({ worker: worker._id })).toBe(1);
  });
});
