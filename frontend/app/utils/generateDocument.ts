/**
 * Document generation — re-exported from the dynamic PDF generator.
 *
 * All documents are now generated dynamically from layout configs defined
 * in documentLayouts.ts. This module preserves the original public API
 * (buildDocumentPDF, viewDocumentPDF, generateDocumentPDF) so callers
 * remain unchanged.
 */
export {
  buildDynamicDocumentPDF as buildDocumentPDF,
  viewDocumentPDF,
  generateDocumentPDF,
} from "./dynamicDocumentGenerator";

// Editable Word (.docx) generation via the docxtemplater template engine.
// Same call contract as the PDF path: viewDocumentDOCX opens the rendered
// document, generateDocumentDOCX downloads it and persists the snapshot.
export {
  buildDynamicDocumentDOCX as buildDocumentDOCX,
  buildDocumentData,
  renderDocxTemplate,
  getDocxTemplateSpec,
  viewDocumentDOCX,
  generateDocumentDOCX,
  viewDocumentPDFFromDOCX,
  generateDocumentPDFFromDOCX,
  printDocumentPDF,
} from "./docxTemplateEngine";