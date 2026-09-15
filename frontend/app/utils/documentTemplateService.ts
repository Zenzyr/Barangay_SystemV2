import axiosInstance from "@/app/utils/axios";

// ─── Dynamic field catalog (used by the Insert Field picker) ───────
export const DYNAMIC_FIELD_GROUPS: Record<string, Record<string, string>> = {
  resident: {
    fullName: "Full Name",
    address: "Address",
    dateOfBirth: "Date of Birth",
    civilStatus: "Civil Status",
    gender: "Gender",
    nationality: "Nationality",
    occupation: "Occupation",
    yearsOfResidency: "Years of Residency",
    purpose: "Purpose",
    contactNumber: "Contact Number",
    purok: "Purok",
    age: "Age",
    spouseName: "Spouse Name",
    annualIncome: "Annual Income",
    monthlyIncome: "Monthly Income",
    householdExpenses: "Monthly Household Expenses",
    workStatus: "Work Status",
    workplace: "Workplace / Company",
    expenseType: "Type of Unforeseen Expense",
    businessName: "Business Name",
    businessAddress: "Business Address",
    businessType: "Business Type",
    businessNature: "Nature of Business",
    titleNo: "Title No.",
    taxDeclarationNo: "Tax Declaration No.",
    landArea: "Land Area (sqm)",
    treeCount: "Number of Trees",
    treeType: "Tree Type",
    assistanceTo: "Assistance To",
  },
  certificate: {
    number: "Certificate Number",
    date: "Issue Date",
  },
  barangay: {
    name: "Barangay Name",
    address: "Barangay Address",
    municipality: "Municipality",
    province: "Province",
    region: "Region",
    captain: "Barangay Captain",
    punongBarangay: "Punong Barangay",
    secretary: "Barangay Secretary",
    contactNumber: "Barangay Contact Number",
  },
};

export const FIELD_LABEL = (key: string): string => {
  const [group, field] = key.split(".");
  if (group && field && DYNAMIC_FIELD_GROUPS[group]) {
    return DYNAMIC_FIELD_GROUPS[group][field] || field;
  }
  return key;
};

// ─── Types ────────────────────────────────────────────────────────
export interface TemplateElement {
  id: string;
  type: "text" | "dynamicText" | "image" | "signature" | "line" | "rect" | "table";
  content?: string;
  field?: string;
  source?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  underline?: boolean;
  color?: string;
  alignment?: "left" | "center" | "right" | "justify";
  lineHeight?: number;
  letterSpacing?: number;
  strokeWidth?: number;
  strokeColor?: string;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  imageFit?: "contain" | "cover" | "stretch";
  signaturePosition?: string;
  rows?: { label: string; value: string }[];
  wrapText?: boolean;
}

export interface DocumentTemplate {
  _id: string;
  name: string;
  description: string;
  documentType: string;
  fee: number;
  currency: string;
  status: "active" | "inactive";
  isDefault: boolean;
  version: number;
  page: {
    size: "A4" | "LETTER";
    orientation: "portrait" | "landscape";
    unit: "pt";
    margins: { top: number; right: number; bottom: number; left: number };
    background?: string;
    watermark?: string;
  };
  elements: TemplateElement[];
  createdAt?: string;
  updatedAt?: string;
}

// ─── API ──────────────────────────────────────────────────────────
export const getTemplates = async (params?: Record<string, string>): Promise<DocumentTemplate[]> => {
  const { data } = await axiosInstance.get("/document-templates", { params });
  return data;
};

export const getPublicTemplates = async (): Promise<DocumentTemplate[]> => {
  const { data } = await axiosInstance.get("/document-templates/public");
  return data;
};

export const getTemplate = async (id: string): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.get(`/document-templates/${id}`);
  return data;
};

export const createTemplate = async (template: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.post("/document-templates", template);
  return data;
};

export const updateTemplate = async (id: string, template: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.put(`/document-templates/${id}`, template);
  return data;
};

export const deleteTemplate = async (id: string) => {
  const { data } = await axiosInstance.delete(`/document-templates/${id}`);
  return data;
};

export const duplicateTemplate = async (id: string): Promise<DocumentTemplate> => {
  const { data } = await axiosInstance.post(`/document-templates/${id}/duplicate`);
  return data;
};

export const seedTemplates = async (): Promise<{ created: string[] }> => {
  const { data } = await axiosInstance.post("/document-templates/seed");
  return data;
};

export const fetchTemplatePreviewPdf = async (id: string): Promise<string> => {
  const response = await axiosInstance.get(`/document-templates/${id}/preview`, { responseType: "blob" });
  const blob = new Blob([response.data], { type: "application/pdf" });
  return URL.createObjectURL(blob);
};