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
  /** Provider label for display ("Semaphore" is the only supported provider). */
  provider: string;
  /** Notification events toggles supported by the backend. */
  notifyOnRequest: boolean;
  notifyOnStatus: boolean;
  notifyOnPayment: boolean;
}

export interface barangaySettingsInterfaceInput {
  barangay: barangayInfoInterface;
  documents: documentSettingsInterface;
  externalRecipients: externalRecipientInterface[];
  sms: smsSettingsInterface;
}

export interface barangaySettingsInterface extends barangaySettingsInterfaceInput {
  _id: string;
  updatedAt: string;
}

export const DEFAULT_SMS_SETTINGS: smsSettingsInterface = {
  enabled: true,
  senderName: "",
  provider: "Semaphore",
  notifyOnRequest: true,
  notifyOnStatus: true,
  notifyOnPayment: true,
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
};