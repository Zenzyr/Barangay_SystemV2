import { Request, Response } from "express";
import CertificateTemplate from "../model/certificateTemplate.model";
import { CertificateGeneratorService } from "../services/certificateGenerator.service";
import DocumentRequestModel from "../model/documentRequest.model";
import { AuthRequest } from "../types/request.type";
import { isStaffRole } from "../utils/roles";
import { isValidObjectId } from "mongoose";

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

  static generate = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { templateId, documentId } = req.params;
      if (!isValidObjectId(templateId) || !isValidObjectId(documentId)) {
        res.status(400).send("Invalid template or document id");
        return;
      }
      const doc = await DocumentRequestModel.findById(documentId).select("resident").lean();
      if (!doc) {
        res.status(404).send("Document request not found");
        return;
      }
      const residentId = String((doc as { resident?: unknown }).resident ?? "");
      if (!isStaffRole(req.account?.role) && req.account?._id !== residentId) {
        res.status(403).send("You can only generate your own documents");
        return;
      }
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
