import LoginAttemptModel from "../model/loginAttempt.model";
import { LOGIN_MAX_ATTEMPTS, LOGIN_LOCK_MINUTES } from "../utils/loginSecurity";

export interface LoginAttemptStatus {
  locked: boolean;
  lockedUntil: Date | null;
  attemptsRemaining: number;
}

export class LoginAttemptService {
  static async getStatus(email: string): Promise<LoginAttemptStatus> {
    const normalized = String(email).trim().toLowerCase();
    const record = await LoginAttemptModel.findOne({ email: normalized });
    const now = new Date();
    const locked = !!(record?.lockedUntil && record.lockedUntil > now);
    return {
      locked,
      lockedUntil: locked ? record!.lockedUntil! : null,
      attemptsRemaining: locked
        ? 0
        : Math.max(0, LOGIN_MAX_ATTEMPTS - (record?.attempts || 0)),
    };
  }

  static async registerFailure(
    email: string
  ): Promise<LoginAttemptStatus & { justLocked: boolean }> {
    const normalized = String(email).trim().toLowerCase();
    const now = new Date();
    let record = await LoginAttemptModel.findOne({ email: normalized });

    if (record?.lockedUntil && record.lockedUntil > now) {
      return {
        locked: true,
        lockedUntil: record.lockedUntil,
        attemptsRemaining: 0,
        justLocked: false,
      };
    }

    if (!record) {
      record = new LoginAttemptModel({ email: normalized, attempts: 0 });
    } else if (record.lockedUntil && record.lockedUntil <= now) {
      // Previous lock expired - start a fresh attempt window.
      record.attempts = 0;
      record.lockedUntil = undefined;
    }

    record.attempts = (record.attempts || 0) + 1;
    record.lastAttemptAt = now;

    let justLocked = false;
    if (record.attempts >= LOGIN_MAX_ATTEMPTS) {
      record.lockedUntil = new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60 * 1000);
      justLocked = true;
    }

    await record.save();

    return {
      locked: !!(record.lockedUntil && record.lockedUntil > now),
      lockedUntil: record.lockedUntil || null,
      attemptsRemaining: Math.max(0, LOGIN_MAX_ATTEMPTS - record.attempts),
      justLocked,
    };
  }

  static async reset(email: string): Promise<void> {
    const normalized = String(email).trim().toLowerCase();
    await LoginAttemptModel.deleteOne({ email: normalized });
  }
}
