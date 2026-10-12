export interface barangayInfoInterface {
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

/**
 * A single official-name region on a document template. Because templates are
 * scanned raster images, dynamic officials are rendered by white-covering the
 * printed region and redrawing the active official's name on top. Coordinates
 * are normalized to the page (0..1), origin at the TOP-LEFT corner so they are
 * independent of image resolution / placement.
 */
export interface officialOverlaySlot {
  /** Official position this slot reflects (e.g. "Punong Barangay"). */
  position: string;
  enabled: boolean;
  /** Normalized bounds of the printed name region (0..1), origin top-left. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Font size as a fraction of the slot height (e.g. 0.85). */
  fontScale: number;
  align: "center" | "left" | "right";
  font: "helvetica-bold" | "helvetica" | "times-bold";
  /** Hex color, e.g. "#000000". */
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

export interface documentSettingsInterface {
  headerText: string;
  footerText: string;
  logoUrl: string;
  sealUrl: string;
  certificateNumberFormat: string;
  signatoryTitle: string;
  signaturePositions: string[];
  
  // Refactored to per-template config
  templates: Record<string, TemplateConfig>;
}

export interface externalRecipientInterface {
  /** Short label, e.g. "Mayor", "Governor". */
  label: string;
  /** Full name with honorific, e.g. "Hon. Bellarmin A. Flores II". */
  name: string;
  /** Position title, e.g. "Mayor". */
  position: string;
}

export interface smsSettingsInterface {
  enabled: boolean;
  /** Public-facing sender name shown on messages. Secrets stay in env. */
  senderName: string;
  /** Notification events toggles supported by the backend. */
  notifyOnRequest: boolean;
  notifyOnStatus: boolean;
  notifyOnPayment: boolean;
  /**
   * Custom message templates keyed by event (see DEFAULT_SMS_TEMPLATES).
   * Each value may contain {{placeholders}} that are filled at send time.
   * Missing keys fall back to the default template.
   */
  templates: Record<string, string>;
  /**
   * Per-template enable flags keyed by template key. A missing key (or `true`)
   * means the template is active; `false` suppresses that specific message.
   */
  templateEnabled: Record<string, boolean>;
}

export interface workScheduleSlotConfig {
  startTime: string;
  endTime: string;
}

export interface workScheduleSettingsInterface {
  slots: workScheduleSlotConfig[];
  slotCapacity: number;
  bookingWindowDays: number;
  workingDays: number[];
}

export interface barangaySettingsInterfaceInput {
  barangay: barangayInfoInterface;
  documents: documentSettingsInterface;
  externalRecipients: externalRecipientInterface[];
  sms: smsSettingsInterface;
  workSchedule?: workScheduleSettingsInterface;
}

export interface barangaySettingsInterface extends barangaySettingsInterfaceInput {
  _id: string;
  updatedAt: string;
}

export const DEFAULT_SMS_SETTINGS: smsSettingsInterface = {
  enabled: true,
  senderName: "",
  notifyOnRequest: true,
  notifyOnStatus: true,
  notifyOnPayment: true,
  templates: {},
  templateEnabled: {},
};

/**
 * Built-in SMS message templates. Placeholders use {{snake_case}} and are
 * replaced at send time (e.g. {{first_name}}, {{document}}, {{status}},
 * {{barangay}}). These are also the fallbacks used when a saved template is
 * blank or missing.
 */
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

export const DEFAULT_WORK_SCHEDULE: workScheduleSettingsInterface = {
  slots: [
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "10:00", endTime: "11:00" },
    { startTime: "13:00", endTime: "14:00" },
    { startTime: "14:00", endTime: "15:00" },
  ],
  slotCapacity: 1,
  bookingWindowDays: 30,
  workingDays: [1, 2, 3, 4, 5, 6],
};

export const DEFAULT_EXTERNAL_RECIPIENTS: externalRecipientInterface[] = [
  { label: "Mayor", name: "Hon. Bellarmin A. Flores II", position: "Mayor" },
];

export const DEFAULT_BARANGAY_SETTINGS: barangaySettingsInterfaceInput = {
  barangay: {
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
  },
  documents: {
    headerText: "",
    footerText: "",
    logoUrl: "/assets/logo.jpg",
    sealUrl: "",
    certificateNumberFormat: "",
    signatoryTitle: "Punong Barangay",
    signaturePositions: [],
    templates: {}, // Initialize as empty object
  },
  externalRecipients: [...DEFAULT_EXTERNAL_RECIPIENTS],
  sms: { ...DEFAULT_SMS_SETTINGS },
  workSchedule: {
    ...DEFAULT_WORK_SCHEDULE,
    slots: DEFAULT_WORK_SCHEDULE.slots.map((s) => ({ ...s })),
    workingDays: [...DEFAULT_WORK_SCHEDULE.workingDays],
  },
};