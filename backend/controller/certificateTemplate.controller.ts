import { Request, Response } from "express";
import CertificateTemplate from "../model/certificateTemplate.model";
import { CertificateGeneratorService } from "../services/certificateGenerator.service";

export class CertificateTemplateController {
  static getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const templates = await CertificateTemplate.find().sort({ createdAt: -1 });
      res.send(templates);
    } catch (error) {
      res.status(500).send("Error fetching templates");
    }
  };

  static create = async (req: Request, res: Response): Promise<void> => {
    try {
      const template = new CertificateTemplate(req.body);
      await template.save();
      res.send(template);
    } catch (error) {
      res.status(500).send("Error creating template");
    }
  };

  static update = async (req: Request, res: Response): Promise<void> => {
    try {
      const template = await CertificateTemplate.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!template) {
        res.status(404).send("Template not found");
        return;
      }
      res.send(template);
    } catch (error) {
      res.status(500).send("Error updating template");
    }
  };

  static delete = async (req: Request, res: Response): Promise<void> => {
    try {
      await CertificateTemplate.findByIdAndDelete(req.params.id);
      res.send({ message: "Template deleted" });
    } catch (error) {
      res.status(500).send("Error deleting template");
    }
  };

  static generate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { templateId, documentId } = req.params;
      const pdfBytes = await CertificateGeneratorService.generatePDF(templateId, documentId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=certificate_${documentId}.pdf`);
      res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error(error);
      res.status(500).send("Error generating PDF");
    }
  };
}
