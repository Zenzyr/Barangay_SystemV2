export const LOGIN_MAX_ATTEMPTS = 3;
export const LOGIN_LOCK_MINUTES = 15;

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
