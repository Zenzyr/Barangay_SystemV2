import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  DocumentTemplateService,
  TemplateInputError,
} from "../services/documentTemplate.service";
import { DocumentTemplateRenderer } from "../services/documentTemplateRenderer.service";
import { isObjectId } from "../utils/validation";
import { validateTiptapDoc } from "../utils/tiptapDoc";

const previewSample = () => ({
  _id: "000000000000000000000001",
  fullName: "Juan Dela Cruz",
  address: "Purok 1, Barangay Rabon",
  dateOfBirth: "1990-01-15",
  civilStatus: "Single",
  nationality: "Filipino",
  occupation: "Farmer",
  yrsOfResidency: 12,
  purpose: "school enrolment",
  contact: "09171234567",
  purok: "Purok 1",
  age: 35,
  spouseName: "Maria Dela Cruz",
  annualIncome: "120,000",
  businessName: "Dela Cruz Sari-Sari Store",
  documentNumber: "BR-2026-0001",
  dateIssued: new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
});

export class DocumentTemplateController {
  /** Staff list of ALL templates (manager page). */
  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { status, search, documentType } = request.query;
      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      if (documentType) filter.documentType = documentType;
      if (search) {
        filter.$or = [
          { name: { $regex: String(search), $options: "i" } },
          { description: { $regex: String(search), $options: "i" } },
          { documentType: { $regex: String(search), $options: "i" } },
        ];
      }
      const templates = await DocumentTemplateService.getAll(filter);
      response.send(templates);
    } catch (error) {
      console.error("[DOC-TEMPLATES LIST ERROR]", error);
      response.status(500).send("Failed to fetch document templates");
    }
  };

  /** Public list: active templates only (drives fee + dropdown data). */
  static getPublic = async (_request: AuthRequest, response: Response) => {
    try {
      const templates = await DocumentTemplateService.getPublic();
      response.send(templates);
    } catch (error) {
      console.error("[DOC-TEMPLATES PUBLIC ERROR]", error);
      response.status(500).send("Failed to fetch document templates");
    }
  };

  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document template id");
        return;
      }
      const template = await DocumentTemplateService.get(id);
      if (!template) {
        response.status(404).send("Document template not found");
        return;
      }
      response.send(template);
    } catch (error) {
      console.error("[DOC-TEMPLATES GET ERROR]", error);
      response.status(500).send("Failed to fetch document template");
    }
  };

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const body = request.body || {};
      if (!String(body.name || "").trim()) {
        response.status(400).send("Template name is required");
        return;
      }
      if (!String(body.documentType || "").trim()) {
        response
          .status(400)
          .send(
            "A document type key is required (e.g. certificateOfIndigency)",
          );
        return;
      }
      const existing = await DocumentTemplateService.getByDocumentType(
        String(body.documentType),
      );
      if (existing) {
        response
          .status(409)
          .send("A template for this document type already exists");
        return;
      }
      const template = await DocumentTemplateService.create(
        body,
        request.account?._id,
      );
      response.status(201).send(template);
    } catch (error: any) {
      if (error instanceof TemplateInputError) {
        response.status(error.status).send(error.message);
        return;
      }
      console.error("[DOC-TEMPLATES CREATE ERROR]", error);
      if (error?.code === 11000) {
        response
          .status(409)
          .send("A template with this document type already exists");
        return;
      }
      response.status(500).send("Failed to create document template");
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document template id");
        return;
      }
      const template = await DocumentTemplateService.update(
        id,
        request.body || {},
        request.account?._id,
      );
      if (!template) {
        response.status(404).send("Document template not found");
        return;
      }
      response.send(template);
    } catch (error) {
      if (error instanceof TemplateInputError) {
        response.status(error.status).send(error.message);
        return;
      }
      console.error("[DOC-TEMPLATES UPDATE ERROR]", error);
      response.status(500).send("Failed to update document template");
    }
  };

  static duplicate = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document template id");
        return;
      }
      const copy = await DocumentTemplateService.duplicate(
        id,
        request.account?._id,
      );
      if (!copy) {
        response.status(404).send("Document template not found");
        return;
      }
      response.status(201).send(copy);
    } catch (error) {
      console.error("[DOC-TEMPLATES DUPLICATE ERROR]", error);
      response.status(500).send("Failed to duplicate document template");
    }
  };

  static remove = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document template id");
        return;
      }
      const deleted = await DocumentTemplateService.delete(id);
      if (!deleted) {
        response.status(404).send("Document template not found");
        return;
      }
      response.send({ message: "Document template deleted" });
    } catch (error) {
      console.error("[DOC-TEMPLATES DELETE ERROR]", error);
      response.status(500).send("Failed to delete document template");
    }
  };

  /** Renders a PDF preview using sample data (works before any request exists). */
  static preview = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document template id");
        return;
      }
      const sample = previewSample();
      const pdf = await DocumentTemplateRenderer.renderPDF(id, {
        data: sample,
        lenient: true,
      });
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `inline; filename="${id}-preview.pdf"`,
      );
      response.send(pdf);
    } catch (error) {
      console.error("[DOC-TEMPLATES PREVIEW ERROR]", error);
      response.status(500).send("Failed to render document template preview");
    }
  };

  /**
   * What the editor opens: the stored Tiptap document, or a converted draft of a
   * legacy layout (with notes on what could not be carried over). Read-only.
   */
  static getEditorContent = async (
    request: AuthRequest,
    response: Response,
  ) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid document template id");
        return;
      }
      const result = await DocumentTemplateService.getEditorContent(id);
      if (!result) {
        response.status(404).send("Document template not found");
        return;
      }
      response.send(result);
    } catch (error) {
      console.error("[DOC-TEMPLATES EDITOR-CONTENT ERROR]", error);
      response.status(500).send("Failed to load the template content");
    }
  };

  /** PDF preview of editor content that has not been saved yet (sample data). */
  static previewContent = async (request: AuthRequest, response: Response) => {
    try {
      const { editorContent, page } = request.body || {};
      const error = validateTiptapDoc(editorContent);
      if (error) {
        response.status(400).send(error);
        return;
      }
      const pdf = await DocumentTemplateRenderer.renderContentPDF(
        editorContent,
        page || {},
        previewSample(),
      );
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        'inline; filename="template-preview.pdf"',
      );
      response.send(pdf);
    } catch (error) {
      console.error("[DOC-TEMPLATES PREVIEW-CONTENT ERROR]", error);
      response.status(500).send("Failed to render document template preview");
    }
  };

  /** Renders a PDF against live request data (POST document request id). */
  static renderDocument = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { requestId } = request.body || {};
      if (!requestId || !isObjectId(requestId)) {
        response.status(400).send("A valid document request id is required");
        return;
      }
      const { DocumentRequestService } =
        await import("../services/documentRequest.service");
      const doc = await DocumentRequestService.get(requestId);
      if (!doc) {
        response.status(404).send("Document request not found");
        return;
      }
      const pdf = await DocumentTemplateRenderer.renderPDF(id, { data: doc });
      response.setHeader("Content-Type", "application/pdf");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="document-${requestId}.pdf"`,
      );
      response.send(pdf);
    } catch (error) {
      console.error("[DOC-TEMPLATES RENDER ERROR]", error);
      response.status(500).send("Failed to render document");
    }
  };

  static seed = async (_request: AuthRequest, response: Response) => {
    try {
      const result = await DocumentTemplateService.seedDefaults();
      response.send(result);
    } catch (error) {
      console.error("[DOC-TEMPLATES SEED ERROR]", error);
      response.status(500).send("Failed to seed document templates");
    }
  };
}

export default DocumentTemplateController;
