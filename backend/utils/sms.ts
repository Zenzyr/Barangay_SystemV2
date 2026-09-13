// Uses Node's built-in global fetch (Node 18+) rather than the "node-fetch"
// package, since node-fetch v3 is ESM-only and this project compiles to CommonJS.

// iProg SMS (iprogsms / iprogtech) - PH SMS API. Send + docs:
//   https://sms.iprogtech.com/api/v1/sms_messages
//   https://sms.iprogtech.com/api/v1/documentation (or www.iprogsms.com)
const IPROG_SMS_API_URL = "https://sms.iprogtech.com/api/v1/sms_messages";

/**
 * Normalizes a PH mobile number into the format iProg SMS accepts
 * (e.g. 09171234567). Returns null if the number doesn't look like a valid PH
 * mobile number. iProg accepts both 0917... and 63917... formats.
 */
function normalizePhoneNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");

  if (digits.length === 11 && digits.startsWith("09")) return digits; // 09171234567
  if (digits.length === 12 && digits.startsWith("639")) return `0${digits.slice(2)}`; // 639171234567 -> 09171234567
  if (digits.length === 10 && digits.startsWith("9")) return `0${digits}`; // 9171234567 -> 09171234567

  return null;
}

/**
 * Sends an SMS via the iProg SMS API. Never throws - failures are logged and
 * swallowed so that SMS delivery issues never break the underlying request flow.
 * Returns true if the message was accepted by iProg SMS, false otherwise.
 */
export const sendSms = async (
  rawNumber: string | undefined | null,
  message: string
): Promise<boolean> => {
  try {
    const apiToken = process.env.IPROG_API_TOKEN;
    if (!apiToken) {
      console.warn("[SMS] IPROG_API_TOKEN is not set - skipping SMS send");
      return false;
    }

    const number = normalizePhoneNumber(rawNumber);
    if (!number) {
      console.warn(`[SMS] Skipping send - invalid or missing phone number: ${rawNumber}`);
      return false;
    }

    const params = new URLSearchParams();
    params.append("api_token", apiToken);
    params.append("phone_number", number);
    params.append("message", message);
    if (process.env.IPROG_SENDER_NAME) {
      params.append("sender_name", process.env.IPROG_SENDER_NAME);
    }

    const response = await fetch(IPROG_SMS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[SMS] iProg SMS API error (${response.status}): ${text}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[SMS] Failed to send SMS:", error);
    return false;
  }
};

/** Notification event kinds that map to the SMS settings toggles. */
export type NotificationKind = "request" | "status" | "payment";

/**
 * Sends an SMS only if SMS notifications are enabled in the barangay settings
 * and the corresponding event toggle is on. The stored sender name is used when
 * set (falling back to the env value). Never throws.
 */
export const sendNotification = async (
  kind: NotificationKind,
  rawNumber: string | undefined | null,
  message: string
): Promise<boolean> => {
  try {
    const { default: BarangaySettingsModel } = await import("../model/barangaySettings.model");
    const settings = (await BarangaySettingsModel.findOne().lean()) as any;
    // If no settings document exists yet, fall back to SMS being enabled.
    const sms = settings?.sms ?? { enabled: true, notifyOnRequest: true, notifyOnStatus: true, notifyOnPayment: true };

    if (!sms?.enabled) {
      console.warn("[SMS] Notifications are disabled in settings - skipping send");
      return false;
    }

    const eventOn =
      kind === "request"
        ? sms.notifyOnRequest
        : kind === "status"
        ? sms.notifyOnStatus
        : sms.notifyOnPayment;
    if (!eventOn) {
      console.warn(`[SMS] '${kind}' notifications are disabled in settings - skipping send`);
      return false;
    }

    const senderName = sms.senderName || process.env.IPROG_SENDER_NAME;
    if (senderName) process.env.IPROG_SENDER_NAME = senderName;

    return sendSms(rawNumber, message);
  } catch (error) {
    console.error("[SMS] sendNotification check failed:", error);
    return sendSms(rawNumber, message);
  }
};
