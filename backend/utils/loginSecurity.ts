export const LOGIN_MAX_ATTEMPTS = 3;
export const LOGIN_LOCK_MINUTES = 15;

/**
 * True only when there is a prior sign-in to compare against AND the incoming
 * device fingerprint (IP and/or browser) differs from the last one. A
 * first-ever login is a baseline, never an anomaly.
 */
export function isNewDeviceLogin(
  previous: {
    lastLoginAt?: Date | null;
    lastLoginIp?: string | null;
    lastLoginUserAgent?: string | null;
  },
  current: { ip: string; userAgent: string },
): boolean {
  if (!previous.lastLoginAt) return false;
  return (
    (previous.lastLoginIp || "") !== current.ip ||
    (previous.lastLoginUserAgent || "") !== current.userAgent
  );
}

export function loginLockedEmailHtml(opts: {
  name?: string;
  attempts: number;
  when: string;
  ip?: string;
  userAgent?: string;
}): string {
  const safeName = String(opts.name || "there").replace(/[<>&]/g, "");
  const safeWhen = String(opts.when || "").replace(/[<>&]/g, "");
  const safeIp = String(opts.ip || "unknown").replace(/[<>&]/g, "");
  const safeUa = String(opts.userAgent || "unknown").replace(/[<>&]/g, "");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #dc2626;">Suspicious Login Attempts Detected</h2>
      <p>Hi ${safeName},</p>
      <p>We locked your Barangay Rabon account for ${LOGIN_LOCK_MINUTES} minutes after <strong>${opts.attempts} failed sign-in attempts</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 0; color: #6b7280;">Date/Time</td><td style="padding: 4px 0;">${safeWhen}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">IP Address</td><td style="padding: 4px 0;">${safeIp}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Device/Browser</td><td style="padding: 4px 0;">${safeUa}</td></tr>
      </table>
      <p>If this was you, you can try signing in again after the lock period. If you don't recognize this activity, consider resetting your password once you regain access.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Barangay Information Management System</p>
    </div>
  `;
}

export function newDeviceLoginEmailHtml(opts: {
  name?: string;
  when: string;
  ip?: string;
  userAgent?: string;
}): string {
  const safeName = String(opts.name || "there").replace(/[<>&]/g, "");
  const safeWhen = String(opts.when || "").replace(/[<>&]/g, "");
  const safeIp = String(opts.ip || "unknown").replace(/[<>&]/g, "");
  const safeUa = String(opts.userAgent || "unknown").replace(/[<>&]/g, "");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h2 style="color: #b45309;">New Sign-In Detected</h2>
      <p>Hi ${safeName},</p>
      <p>Your Barangay Rabon account was just signed in from a <strong>new device or location</strong>.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">
        <tr><td style="padding: 4px 0; color: #6b7280;">Date/Time</td><td style="padding: 4px 0;">${safeWhen}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">IP Address</td><td style="padding: 4px 0;">${safeIp}</td></tr>
        <tr><td style="padding: 4px 0; color: #6b7280;">Device/Browser</td><td style="padding: 4px 0;">${safeUa}</td></tr>
      </table>
      <p>If this was you, you can safely ignore this message. If you don't recognize this activity, change your password immediately — someone else may have access to your account.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Barangay Information Management System</p>
    </div>
  `;
}
