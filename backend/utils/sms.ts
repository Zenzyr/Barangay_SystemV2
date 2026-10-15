// Uses Node's built-in global fetch (Node 18+) rather than the "node-fetch"
// package, since node-fetch v3 is ESM-only and this project compiles to CommonJS.

import {
  SMS_TEMPLATE_DEFAULTS,
  renderSmsTemplate,
  SmsTemplateKey,
} from "./smsTemplates";

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

interface IprogResult {
  ok: boolean;
  message?: string;
  messageId?: string;
}

/**
 * Parses an iProg API response body. iProg replies with JSON such as
 * `{ "status": 200, "message": "Message queued...", "message_id": "iSms-XXXX" }`
 * on success, but it can also report a failure inside the body while still
 * returning HTTP 200. Reading the body (instead of trusting the status code)
 * means a rejected send is never mistaken for success. Falls back to the HTTP
 * status when the body isn't JSON.
 */
function parseIprogResponse(rawText: string, httpOk: boolean): IprogResult {
  const text = (rawText || "").trim();
  if (text) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (data && typeof data === "object") {
        const status = data.status;
        const message =
          typeof data.message === "string" ? data.message : undefined;
        const messageId =
          typeof data.message_id === "string" ? data.message_id : undefined;
        const ok =
          Boolean(messageId) ||
          status === 200 ||
          status === "200" ||
          status === "success" ||
          status === "Success";
        return { ok, message, messageId };
      }
    } catch {
      // Not JSON - fall through to the HTTP status below.
    }
  }
  return { ok: httpOk, message: text || undefined };
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

    // iProg bills per SMS segment; flag multi-segment sends so the extra credit
    // cost (and any non-GSM characters that force UCS-2) is visible in logs.
    if (message.length > 160 || /[^\x00-\x7F]/.test(message)) {
      console.warn(
        `[SMS] Message may use more than 1 credit (length ${message.length}, non-ASCII: ${/[^\x00-\x7F]/.test(message)})`
      );
    }

    const response = await fetch(IPROG_SMS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    const text = await response.text();
    const result = parseIprogResponse(text, response.ok);

    if (!response.ok || !result.ok) {
      console.error(
        `[SMS] iProg rejected send (HTTP ${response.status}): ${result.message ?? text}`
      );
      return false;
    }

    console.log(
      `[SMS] iProg accepted message${result.messageId ? ` (${result.messageId})` : ""}: ${result.message ?? "queued"}`
    );
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
 * and the corresponding event toggle is on. The message is built from the
 * customizable template stored in settings (falling back to the built-in
 * default) with `vars` filling the {{placeholders}}. The stored sender name is
 * used when set (falling back to the env value). Never throws.
 */
export const sendNotification = async (
  kind: NotificationKind,
  rawNumber: string | undefined | null,
  templateKey: SmsTemplateKey,
  vars: Record<string, string> = {},
): Promise<boolean> => {
  const fallbackTemplate =
    SMS_TEMPLATE_DEFAULTS[templateKey] ?? SMS_TEMPLATE_DEFAULTS.statusOther;
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

    // Per-template switch: a template explicitly turned off is skipped even if
    // its event category is enabled. Missing keys default to enabled.
    if (sms?.templateEnabled?.[templateKey] === false) {
      console.warn(`[SMS] Template '${templateKey}' is disabled in settings - skipping send`);
      return false;
    }

    const senderName = sms.senderName || process.env.IPROG_SENDER_NAME;
    if (senderName) process.env.IPROG_SENDER_NAME = senderName;

    const savedTemplate = sms?.templates?.[templateKey];
    const template =
      typeof savedTemplate === "string" && savedTemplate.trim()
        ? savedTemplate
        : fallbackTemplate;
    const message = renderSmsTemplate(template, {
      ...vars,
      barangay: settings?.barangay?.name || "Barangay Rabon",
    });

    return sendSms(rawNumber, message);
  } catch (error) {
    console.error("[SMS] sendNotification check failed:", error);
    return sendSms(rawNumber, renderSmsTemplate(fallbackTemplate, vars));
  }
};
