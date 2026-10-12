export interface barangayInfo {
  name: string;
  municipality: string;
  province: string;
  region: string;
  address: string;
  contactNumber: string;
  email: string;
  logoUrl: string;
  sealUrl: string;
  headerText: string;
  footerText: string;
}

export interface officialOverlaySlot {
  position: string;
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  fontScale: number;
  align: "center" | "left" | "right";
  font: "helvetica-bold" | "helvetica" | "times-bold";
  textColor: string;
}

export interface TemplateConfig {
  backgroundUrl: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  overlays: officialOverlaySlot[]; 
}

export interface documentSettings {
  headerText: string;
  footerText: string;
  logoUrl: string;
  sealUrl: string;
  certificateNumberFormat: string;
  signatoryTitle: string;
  signaturePositions: string[];
  watermarkText: string;
  templates: Record<string, TemplateConfig>;
}

export interface externalRecipient {
  label: string;
  name: string;
  position: string;
}

export interface smsSettings {
  enabled: boolean;
  senderName: string;
  notifyOnRequest: boolean;
  notifyOnStatus: boolean;
  notifyOnPayment: boolean;
  /** Custom message templates keyed by event; supports {{placeholders}}. */
  templates: Record<string, string>;
  /** Per-template switches; a missing key means the template is enabled. */
  templateEnabled: Record<string, boolean>;
}

/** Placeholders that can be inserted into any SMS template. */
export const SMS_VARIABLES: { token: string; description: string }[] = [
  { token: "{{first_name}}", description: "Resident's first name" },
  { token: "{{name}}", description: "Resident's full name" },
  { token: "{{document}}", description: "Requested document type" },
  { token: "{{status}}", description: "Request status (status updates only)" },
  { token: "{{barangay}}", description: "Barangay name" },
];

/** Built-in SMS templates (mirrors the backend defaults). */
export const DEFAULT_SMS_TEMPLATES: Record<string, string> = {
  requestReceived:
    "Hi {{first_name}}, we received your request for {{document}}. We'll text you updates on its status. - {{barangay}}",
  statusProcessing:
    "Hi {{first_name}}, your request for {{document}} is now being processed.",
  statusReady:
    "Hi {{first_name}}, your {{document}} is ready for pickup at the barangay hall. Please bring a valid ID.",
  statusReleased:
    "Hi {{first_name}}, your {{document}} has been released to you. Thank you for picking it up!",
  statusCancelled:
    "Hi {{first_name}}, your request for {{document}} has been cancelled. Visit the barangay hall if this was a mistake.",
  statusCompleted:
    "Hi {{first_name}}, your request for {{document}} has been marked completed. Thank you!",
  statusOther:
    'Hi {{first_name}}, your request for {{document}} status has been updated to "{{status}}".',
  paymentReceived:
    "Hi {{first_name}}, we've received your payment for {{document}}. Thank you!",
  paymentRejected:
    "Hi {{first_name}}, your payment for {{document}} could not be verified by the barangay treasurer. Please check your notifications or visit the barangay hall.",
  accountApproved:
    "Hi {{first_name}}, your barangay resident account has been approved! You can now log in and request documents.",
  accountRejected:
    "Hi {{first_name}}, your barangay resident account application was rejected. Please visit or contact the barangay office, or resubmit your ID documents.",
};

/** The editable template list shown in the SMS settings UI. */
export const SMS_TEMPLATE_FIELDS: {
  key: string;
  label: string;
  description: string;
  variables: string[];
}[] = [
  {
    key: "requestReceived",
    label: "New request received",
    description: "Sent when a resident submits a document request.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "statusProcessing",
    label: "Status: processing",
    description: "Sent when a request starts being processed.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "statusReady",
    label: "Status: ready for pickup",
    description: "Sent when the document is ready for pickup.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "statusReleased",
    label: "Status: released",
    description: "Sent when the document is released.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "statusCancelled",
    label: "Status: cancelled",
    description: "Sent when a request is cancelled.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "statusCompleted",
    label: "Status: completed",
    description: "Sent when a request is marked completed.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "statusOther",
    label: "Status: other",
    description: "Fallback for any other status change.",
    variables: ["first_name", "name", "document", "status", "barangay"],
  },
  {
    key: "paymentReceived",
    label: "Payment received",
    description: "Sent when a payment is recorded.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "paymentRejected",
    label: "Payment rejected",
    description: "Sent when a payment cannot be verified.",
    variables: ["first_name", "name", "document", "barangay"],
  },
  {
    key: "accountApproved",
    label: "Account approved",
    description: "Sent when a resident account is approved.",
    variables: ["first_name", "name", "barangay"],
  },
  {
    key: "accountRejected",
    label: "Account rejected",
    description: "Sent when a resident account is rejected.",
    variables: ["first_name", "name", "barangay"],
  },
];

export interface workScheduleSlotConfig {
  startTime: string;
  endTime: string;
}

export interface workScheduleSettings {
  slots: workScheduleSlotConfig[];
  slotCapacity: number;
  bookingWindowDays: number;
  workingDays: number[];
}

export interface barangaySettings {
  _id: string;
  barangay: barangayInfo;
  documents: documentSettings;
  externalRecipients: externalRecipient[];
  sms: smsSettings;
  workSchedule?: workScheduleSettings;
  updatedAt: string;
}

export const EMPTY_BARANGAY_INFO: barangayInfo = {
  name: "Barangay Rabon",
  municipality: "Rosario",
  province: "La Union",
  region: "Ilocos Region",
  address: "",
  contactNumber: "",
  email: "",
  logoUrl: "/assets/logo.jpg",
  sealUrl: "",
  headerText: "",
  footerText: "",
};

export const EMPTY_DOCUMENT_SETTINGS: documentSettings = {
  headerText: "",
  footerText: "",
  logoUrl: "/assets/logo.jpg",
  sealUrl: "",
  certificateNumberFormat: "",
  signatoryTitle: "Punong Barangay",
  signaturePositions: [],
  watermarkText: "",
  templates: {},
};

export const EMPTY_SMS_SETTINGS: smsSettings = {
  enabled: true,
  senderName: "",
  notifyOnRequest: true,
  notifyOnStatus: true,
  notifyOnPayment: true,
  templates: {},
  templateEnabled: {},
};

export const EMPTY_EXTERNAL_RECIPIENTS: externalRecipient[] = [
  { label: "Mayor", name: "Hon. Bellarmin A. Flores II", position: "Mayor" },
];
