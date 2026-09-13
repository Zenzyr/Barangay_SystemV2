import axiosInstance from "@/app/utils/axios";

export interface CertificateTemplateBlock {
    id: string;
    type: "text" | "image";
    content: string;
}

export interface CertificateTemplate {
    _id: string;
    name: string;
    documentType: string;
    layoutConfig: {
        backgroundUrl: string;
        blocks: CertificateTemplateBlock[];
    };
    signatoryConfig: Record<string, { name: string; position: string }>;
}

export interface CertificateTemplateInput {
    name: string;
    documentType?: string;
    layoutConfig: {
        backgroundUrl?: string;
        blocks: {
            id?: string;
            type: "text" | "image";
            content?: string;
        }[];
    };
    signatoryConfig?: Record<string, { name: string; position: string }>;
}

export const getTemplates = async (): Promise<CertificateTemplate[]> => {
    const { data } = await axiosInstance.get("/certificate-templates");
    return data;
};

export const createTemplate = async (template: CertificateTemplateInput): Promise<CertificateTemplate> => {
    const { data } = await axiosInstance.post("/certificate-templates", template);
    return data;
};

export const updateTemplate = async (id: string, template: CertificateTemplateInput): Promise<CertificateTemplate> => {
    const { data } = await axiosInstance.put(`/certificate-templates/${id}`, template);
    return data;
};

export const deleteTemplate = async (id: string): Promise<CertificateTemplate> => {
    const { data } = await axiosInstance.delete(`/certificate-templates/${id}`);
    return data;
};

export const generateTemplatePDF = async (templateId: string, documentId: string): Promise<Blob> => {
    const response = await axiosInstance.get(`/certificate-templates/generate/${templateId}/${documentId}`, {
        responseType: 'blob'
    });
    return response.data;
};

