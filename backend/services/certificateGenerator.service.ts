import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import CertificateTemplate from '../model/certificateTemplate.model';
import Documents from '../model/documentRequest.model';
import Official from '../model/official.model';

export class CertificateGeneratorService {
  /**
   * Generates a PDF based on a template configuration and dynamic request data.
   */
  static generatePDF = async (templateId: string, documentId: string) => {
    // 1. Fetch the template, request data, and active officials
    const template = await CertificateTemplate.findById(templateId);
    if (!template) throw new Error("Template not found");
    
    const requestData = await Documents.findById(documentId).populate('resident');
    if (!requestData) throw new Error("Document request not found");

    const activeOfficials = await Official.find({ status: 'active' });

    // 2. Initialize PDF Document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard Letter size
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // 3. Render blocks, passing signatoryConfig and activeOfficials for potential override
    await this.renderBlocks(page, font, template.layoutConfig.blocks, requestData, template.signatoryConfig || {}, activeOfficials);

    // 4. Save and return the PDF bytes
    return await pdfDoc.save();
  };

  private static renderBlocks = async (page: any, font: any, blocks: any[], data: any, signatoryConfig: any, activeOfficials: any[]) => {
    let yOffset = 700; // Starting Y coordinate

    for (const block of blocks) {
      if (block.type === 'text') {
        // Resolve placeholders in block.content
        const content = this.resolvePlaceholders(block.content, data, signatoryConfig, activeOfficials);
        
        page.drawText(content, {
          x: 50,
          y: yOffset,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
          maxWidth: 500,
        });
        yOffset -= 30; // Move down
      }
      // Image rendering logic would go here
    }
  };

  private static resolvePlaceholders = (text: string, data: any, signatoryConfig: any, activeOfficials: any[]) => {
      // Basic placeholder replacement logic
      let resolved = text
        .replace("{{resident.fullName}}", data.fullName || data.resident?.name || "")
        .replace("{{resident.address}}", data.address || "")
        .replace("{{certificate.date}}", new Date().toLocaleDateString());

      // Replace signatory placeholders if any (e.g., {{official.Barangay Captain}})
      // This is a basic implementation; more complex logic might be needed
      for (const pos in signatoryConfig) {
          const placeholder = `{{official.${pos}}}`;
          if (resolved.includes(placeholder)) {
              const name = signatoryConfig[pos].name || this.findOfficialName(pos, activeOfficials);
              resolved = resolved.replace(placeholder, name);
          }
      }
      return resolved;
  };

  private static findOfficialName = (position: string, activeOfficials: any[]) => {
      const official = activeOfficials.find(o => o.position === position);
      return official ? official.fullName : "";
  }
}
