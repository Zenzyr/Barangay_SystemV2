import ScheduleSlotModel from "../model/scheduleSlot.model";
import { BarangaySettingsService } from "./barangaySettings.service";
import {
  DEFAULT_WORK_SCHEDULE,
  workScheduleSettingsInterface,
  workScheduleSlotConfig,
} from "../types/barangaySettings.type";
import { isObjectId } from "../utils/validation";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

export class ScheduleError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = "INVALID_SCHEDULE") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const formatTime12h = (time: string) => {
  if (!TIME_RE.test(time)) return time;
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${pad(hour)}:${pad(m)} ${suffix}`;
};

export const formatSlotLabel = (startTime: string, endTime: string) =>
  `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;

export const localDateString = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const localTimeString = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseLocalDate = (value: string): Date | null => {
  if (!DATE_RE.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
};

export const normalizeWorkScheduleConfig = (raw: any): workScheduleSettingsInterface => {
  if (!raw || typeof raw !== "object") {
    throw new Error("workSchedule must be an object");
  }

  const rawSlots = Array.isArray(raw.slots) ? raw.slots : null;
  if (!rawSlots || rawSlots.length === 0) {
    throw new Error("At least one work schedule time slot is required");
  }
  if (rawSlots.length > 24) {
    throw new Error("A maximum of 24 time slots can be configured");
  }

  const slots: workScheduleSlotConfig[] = rawSlots.map((slot: any) => {
    const startTime = String(slot?.startTime ?? "").trim();
    const endTime = String(slot?.endTime ?? "").trim();
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      throw new Error("Time slots must use the 24-hour HH:mm format");
    }
    if (toMinutes(endTime) <= toMinutes(startTime)) {
      throw new Error(`Time slot ${startTime}–${endTime} must end after it starts`);
    }
    return { startTime, endTime };
  });

  slots.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  for (let i = 1; i < slots.length; i++) {
    if (toMinutes(slots[i].startTime) < toMinutes(slots[i - 1].endTime)) {
      throw new Error(
        `Time slots ${slots[i - 1].startTime}–${slots[i - 1].endTime} and ${slots[i].startTime}–${slots[i].endTime} overlap`,
      );
    }
  }

  const slotCapacity = Number(raw.slotCapacity);
  if (!Number.isInteger(slotCapacity) || slotCapacity < 1 || slotCapacity > 50) {
    throw new Error("Slot capacity must be a whole number between 1 and 50");
  }

  const bookingWindowDays = Number(raw.bookingWindowDays);
  if (!Number.isInteger(bookingWindowDays) || bookingWindowDays < 1 || bookingWindowDays > 180) {
    throw new Error("Booking window must be a whole number of days between 1 and 180");
  }

  const rawDays = Array.isArray(raw.workingDays) ? raw.workingDays : null;
  if (!rawDays || rawDays.length === 0) {
    throw new Error("At least one working day is required");
  }
  const workingDays = [...new Set(rawDays.map(Number))].sort() as number[];
  if (workingDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error("Working days must be numbers from 0 (Sunday) to 6 (Saturday)");
  }

  return { slots, slotCapacity, bookingWindowDays, workingDays };
};

export class WorkScheduleService {

  static async getConfig(): Promise<workScheduleSettingsInterface> {
    const settings: any = await BarangaySettingsService.get();
    const config = settings?.workSchedule;
    try {
      return normalizeWorkScheduleConfig(config);
    } catch {
      return {
        ...DEFAULT_WORK_SCHEDULE,
        slots: DEFAULT_WORK_SCHEDULE.slots.map((s) => ({ ...s })),
        workingDays: [...DEFAULT_WORK_SCHEDULE.workingDays],
      };
    }
  }

  static validateDate(date: unknown, config: workScheduleSettingsInterface, now: Date = new Date()): string | null {
    if (typeof date !== "string") return "A schedule date is required";
    const parsed = parseLocalDate(date);
    if (!parsed) return "Schedule date must be a valid date (YYYY-MM-DD)";

    const today = parseLocalDate(localDateString(now))!;
    if (parsed.getTime() < today.getTime()) return "Schedule date cannot be in the past";

    const last = new Date(today);
    last.setDate(last.getDate() + config.bookingWindowDays);
    if (parsed.getTime() > last.getTime()) {
      return `Schedule date must be within the next ${config.bookingWindowDays} days`;
    }

    if (!config.workingDays.includes(parsed.getDay())) {
      return "Work requests cannot be scheduled on this day";
    }
    return null;
  }

  static isSlotPast(date: string, startTime: string, now: Date = new Date()) {
    const today = localDateString(now);
    if (date < today) return true;
    if (date > today) return false;
    return toMinutes(startTime) <= toMinutes(localTimeString(now));
  }

  static async getAvailability(providerId: string, date: string, now: Date = new Date()): Promise<DayAvailability> {
    if (!isObjectId(providerId)) throw new ScheduleError("A valid provider is required");
    const config = await this.getConfig();
    const dateError = this.validateDate(date, config, now);

    if (dateError) {
      if (!parseLocalDate(String(date))) throw new ScheduleError(dateError);
      return { provider: providerId, date, open: false, closedReason: dateError, slots: [] };
    }

    const existing = await ScheduleSlotModel.find({ provider: providerId, date }).lean();
    const bookedByStart = new Map(existing.map((s: any) => [s.startTime, Number(s.bookedCount) || 0]));

    const slots = config.slots.map((slot): SlotAvailability => {
      const booked = bookedByStart.get(slot.startTime) ?? 0;
      const remaining = Math.max(0, config.slotCapacity - booked);
      const status: SlotStatus = this.isSlotPast(date, slot.startTime, now)
        ? "past"
        : remaining <= 0
          ? "full"
          : "available";
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        label: formatSlotLabel(slot.startTime, slot.endTime),
        capacity: config.slotCapacity,
        booked,
        remaining,
        status,
      };
    });

    return { provider: providerId, date, open: true, closedReason: null, slots };
  }

  static async reserve(providerId: string, date: unknown, startTime: unknown, now: Date = new Date()) {
    if (!isObjectId(providerId)) throw new ScheduleError("A valid provider is required");
    const config = await this.getConfig();

    const dateError = this.validateDate(date, config, now);
    if (dateError) throw new ScheduleError(dateError);

    if (typeof startTime !== "string" || !TIME_RE.test(startTime)) {
      throw new ScheduleError("A valid time slot is required");
    }
    const configured = config.slots.find((s) => s.startTime === startTime);
    if (!configured) {
      throw new ScheduleError("The selected time slot is not part of the barangay work schedule");
    }
    if (this.isSlotPast(date as string, startTime, now)) {
      throw new ScheduleError("The selected time slot has already started", 409, "SLOT_UNAVAILABLE");
    }

    const key = { provider: providerId, date: date as string, startTime };

    try {
      await ScheduleSlotModel.updateOne(
        key,
        {
          $setOnInsert: {
            ...key,
            endTime: configured.endTime,
            capacity: config.slotCapacity,
            bookedCount: 0,
          },
        },
        { upsert: true },
      );
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }

    const reserved = await ScheduleSlotModel.findOneAndUpdate(
      { ...key, bookedCount: { $lt: config.slotCapacity } },
      {
        $inc: { bookedCount: 1 },
        $set: { capacity: config.slotCapacity, endTime: configured.endTime },
      },
      { new: true },
    );

    if (!reserved) {
      throw new ScheduleError(
        "The selected time slot is fully booked. Please choose another slot.",
        409,
        "SLOT_UNAVAILABLE",
      );
    }
    return reserved;
  }

  static async release(slotId: unknown) {
    if (!slotId || !isObjectId(String(slotId))) return null;
    return ScheduleSlotModel.findOneAndUpdate(
      { _id: slotId, bookedCount: { $gt: 0 } },
      { $inc: { bookedCount: -1 } },
      { new: true },
    );
  }
}
