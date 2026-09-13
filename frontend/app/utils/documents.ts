/**
 * Document type registry — re-exported from documentLayouts.ts.
 *
 * All document definitions (fields, prices, layouts) now live in
 * documentLayouts.ts and are consumed by the dynamic PDF generator.
 * This module preserves backward compatibility for any code that
 * imports from documents.ts.
 */
export { documentTypes, getDocumentPrice } from "./documentLayouts";