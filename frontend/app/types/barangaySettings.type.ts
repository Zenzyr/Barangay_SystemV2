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
  provider: string;
  notifyOnRequest: boolean;
  notifyOnStatus: boolean;
  notifyOnPayment: boolean;
}

export interface barangaySettings {
  _id: string;
  barangay: barangayInfo;
  documents: documentSettings;
  externalRecipients: externalRecipient[];
  sms: smsSettings;
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
  provider: "Semaphore",
  notifyOnRequest: true,
  notifyOnStatus: true,
  notifyOnPayment: true,
};

export const EMPTY_EXTERNAL_RECIPIENTS: externalRecipient[] = [
  { label: "Mayor", name: "Hon. Bellarmin A. Flores II", position: "Mayor" },
];
