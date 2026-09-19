import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { DocTemplateService, DocTemplateError, validatePage } from "../services/docTemplate.service";
import { exportTemplateToDocx, DOCX_MIME_TYPE } from "../services/docTemplateExport.service";
import { TEMPLATE_VARIABLES, VARIABLE_KEY_PATTERN } from "../utils/templateVariables";
import { validateTiptapDoc } from "../utils/tiptapDoc";
import { isObjectId } from "../utils/validation";

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

  static seed = async (request: AuthRequest, response: Response) => {
    try {
      const result = await DocTemplateService.seed(request.account?._id);
      return response.json(result);
    } catch (error) {
      return fail(response, error, "SEED", "Failed to import default templates");
    }
  };
}
