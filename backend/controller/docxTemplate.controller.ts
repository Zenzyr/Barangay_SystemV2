import { Response } from "express";
import path from "path";
import { AuthRequest } from "../types/request.type";
import { DocTemplateService, DocTemplateError, validatePage } from "../services/docTemplate.service";
import { exportTemplateToDocx, DOCX_MIME_TYPE } from "../services/docTemplateExport.service";
import { replaceVariablesInDocx } from "../services/docTemplateFidelity.service";
import { DocumentTemplateService } from "../services/documentTemplate.service";
import { DocumentRequestService } from "../services/documentRequest.service";
import { TEMPLATE_VARIABLES, VARIABLE_KEY_PATTERN } from "../utils/templateVariables";
import { validateTiptapDoc } from "../utils/tiptapDoc";
import { isObjectId } from "../utils/validation";
import { isStaffRole } from "../utils/roles";

const MAX_VALUE_LENGTH = 500;

/** Maps service errors to their HTTP status; anything else is a 500. */
function fail(response: Response, error: unknown, label: string, fallback: string) {
  if (error instanceof DocTemplateError) return response.status(error.status).send(error.message);
  console.error(`[DOCX-TEMPLATE ${label} ERROR]`, error);
  return response.status(500).send(fallback);
}

export class DocxTemplateController {
  static list = async (_request: AuthRequest, response: Response) => {
    try {
      return response.json(await DocTemplateService.list());
    } catch (error) {
      return fail(response, error, "LIST", "Failed to list document templates");
    }
  };

  /** The variable registry the editor's "Insert Variable" menu is built from. */
  static variables = async (_request: AuthRequest, response: Response) => {
    return response.json(
      TEMPLATE_VARIABLES.map(({ key, label, group, note }) => ({ key, label, group, ...(note ? { note } : {}) }))
    );
  };

  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) return response.status(400).send("Invalid template id");
      const template = await DocTemplateService.get(id);
      if (!template) return response.status(404).send("Template not found");
      return response.json(template);
    } catch (error) {
      return fail(response, error, "GET", "Failed to fetch document template");
    }
  };

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) return response.status(400).send("Invalid template id");
      const template = await DocTemplateService.update(id, request.body || {}, request.account?._id);
      if (!template) return response.status(404).send("Template not found");
      return response.json(template);
    } catch (error) {
      return fail(response, error, "UPDATE", "Failed to save document template");
    }
  };

  static duplicate = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) return response.status(400).send("Invalid template id");
      const copy = await DocTemplateService.duplicate(id, request.account?._id);
      if (!copy) return response.status(404).send("Template not found");
      return response.status(201).json(copy);
    } catch (error) {
      return fail(response, error, "DUPLICATE", "Failed to duplicate document template");
    }
  };

  static remove = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) return response.status(400).send("Invalid template id");
      const removed = await DocTemplateService.remove(id);
      if (!removed) return response.status(404).send("Template not found");
      return response.json({ message: "Template deleted" });
    } catch (error) {
      return fail(response, error, "DELETE", "Failed to delete document template");
    }
  };

  /**
   * Streams a .docx. Body (all optional): `editorContent`/`page`/`name` export
   * what is currently in the editor (unsaved edits included); `values` fills
   * {{variables}} — unresolved variables stay visible as {{key}}.
   */
  static exportDocx = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) return response.status(400).send("Invalid template id");
      const template: any = await DocTemplateService.get(id);
      if (!template) return response.status(404).send("Template not found");

      const body = request.body || {};
      if (body.editorContent !== undefined) {
        const error = validateTiptapDoc(body.editorContent);
        if (error) return response.status(400).send(error);
      }
      const pageError = validatePage(body.page);
      if (pageError) return response.status(400).send(pageError);

      let values: Record<string, string> | undefined;
      if (body.values !== undefined) {
        if (!body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
          return response.status(400).send("values must be an object");
        }
        values = {};
        for (const [key, value] of Object.entries(body.values)) {
          if (!VARIABLE_KEY_PATTERN.test(key) || typeof value !== "string" || value.length > MAX_VALUE_LENGTH) {
            return response.status(400).send("values must map variable keys to short strings");
          }
          values[key] = value;
        }
      }

      const { buffer, warnings } = await exportTemplateToDocx(
        {
          name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : template.name,
          editorContent: body.editorContent ?? template.editorContent,
          page: { ...template.page, ...(body.page || {}), margins: { ...template.page?.margins, ...(body.page?.margins || {}) } },
        },
        values
      );

      response.setHeader("Content-Type", DOCX_MIME_TYPE);
      response.setHeader("Content-Disposition", `attachment; filename="${template.slug}.docx"`);
      response.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Export-Warnings");
      if (warnings.length) response.setHeader("X-Export-Warnings", encodeURIComponent(JSON.stringify(warnings)));
      return response.send(buffer);
    } catch (error) {
      return fail(response, error, "EXPORT", "Failed to export document template");
    }
  };

  /**
   * Renders the DOCX template that is bound to a document request code, filled
   * with that request's live data (resident fields, officials, issue date).
   * Used by the secretary's generation path so that editing the admin DOCX
   * template updates the generated document. Returns 404 when no template is
   * bound to the document type, so callers can fall back to static assets.
   */
  static renderByType = async (request: AuthRequest, response: Response) => {
    try {
      const { requestId } = request.body || {};
      if (!requestId || !isObjectId(requestId)) {
        return response.status(400).send("A valid document request id is required");
      }
      const doc: any = await DocumentRequestService.get(requestId);
      if (!doc) return response.status(404).send("Document request not found");

      const account = request.account;
      const residentId = String(doc.resident?._id || doc.resident || "");
      if (!isStaffRole(account?.role) && account?._id !== residentId) {
        return response.status(403).send("You can only render your own requests");
      }

      const template: any = await DocTemplateService.getByDocumentType(doc.document);
      if (!template) {
        return response.status(404).send("No DOCX template bound to this document type");
      }

      const values = await DocumentTemplateService.buildVariableValues(doc);

      let buffer: Buffer;
      let warnings: string[] = [];

      if (template.sourceType === "original-docx") {
        const result = await DocTemplateService.getOriginalDocumentData(template._id);
        if (!result) return response.status(404).send("Original document data not found");
        buffer = await replaceVariablesInDocx(result.data, values);
      } else {
        const exportRes = await exportTemplateToDocx(
          {
            name: template.name,
            editorContent: template.editorContent,
            page: template.page,
          },
          values
        );
        buffer = exportRes.buffer;
        warnings = exportRes.warnings;
      }

      response.setHeader("Content-Type", DOCX_MIME_TYPE);
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${template.slug || `${doc.document}.docx`}"`
      );
      response.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Export-Warnings");
      if (warnings.length) response.setHeader("X-Export-Warnings", encodeURIComponent(JSON.stringify(warnings)));
      return response.send(buffer);
    } catch (error) {
      return fail(response, error, "RENDER-BY-TYPE", "Failed to render document template");
    }
  };

  static seed = async (request: AuthRequest, response: Response) => {
    try {
      const result = await DocTemplateService.seed(request.account?._id);
      return response.json(result);
    } catch (error) {
      return fail(response, error, "SEED", "Failed to import default templates");
    }
  };

  /**
   * Stores an original DOCX package as the template's source document
   * (sets `sourceType` to "original-docx"; the package is kept byte-for-byte
   * with a SHA-256 fingerprint). Phase 1 — placeholder replacement inside the
   * package is Phase 2.
   */
  static uploadOriginalDocx = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) return response.status(400).send("Invalid template id");
      if (!request.file) return response.status(400).send("A .docx file is required");

      const template = await DocTemplateService.uploadOriginalDocx(
        id,
        {
          buffer: request.file.buffer,
          originalname: request.file.originalname,
          mimetype: request.file.mimetype,
        },
        request.account?._id
      );
      if (!template) return response.status(404).send("Template not found");
      return response.json(template);
    } catch (error) {
      return fail(response, error, "UPLOAD-ORIGINAL", "Failed to store the original document");
    }
  };

  /**
   * Streams the stored original DOCX package back as an attachment. Lets staff
   * (and, later, the OOXML renderer) retrieve the byte-exact source document.
   */
  static getOriginalDocx = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) return response.status(400).send("Invalid template id");

      const result = await DocTemplateService.getOriginalDocumentData(id);
      if (!result) return response.status(404).send("Template not found or has no original document");

      const { template, data } = result;
      const safeName =
        path
          .basename(template.originalDocx?.originalFilename || `${template.slug}.docx`)
          .replace(/[^\w.\- ]+/g, "_") || `${template.slug}.docx`;

      response.setHeader("Content-Type", template.originalDocx?.mimeType || DOCX_MIME_TYPE);
      response.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      response.setHeader("Access-Control-Expose-Headers", "Content-Disposition, X-Original-Sha256");
      if (template.originalDocx?.sha256) {
        response.setHeader("X-Original-Sha256", template.originalDocx.sha256);
      }
      return response.send(data);
    } catch (error) {
      return fail(response, error, "GET-ORIGINAL", "Failed to download the original document");
    }
  };
}
