import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ReportService } from "../services/report.service";
import { parseTransactionFilters, validateDateRange } from "../services/transaction.service";
import { PERMISSIONS, hasPermission, isStaffRole } from "../utils/roles";

const DOCUMENT_STATUSES = ["pending", "processing", "ready", "released", "cancelled", "to claim", "completed", "rejected"];
const WORK_STATUSES = ["pending", "active", "accepted", "to review", "completed", "rejected"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ReportController {

  static generate = async (request: AuthRequest, response: Response) => {
    try {
      const type = String(request.query.type || "documents");
      if (!["documents", "payments", "work", "collections"].includes(type)) {
        response.status(400).json({ message: "Report type must be documents, payments, work, or collections" });
        return;
      }
      const role = request.account?.role;
      const allowed = type === "collections" ? hasPermission(role, PERMISSIONS.COLLECTION_REPORTS_VIEW) : isStaffRole(role);
      if (!allowed) {
        response.status(403).json({ message: "Access denied" });
        return;
      }

      const status = typeof request.query.status === "string" ? request.query.status : "";
      const generatedAt = new Date().toISOString();

      if (type === "work") {
        const from = typeof request.query.from === "string" && DATE_RE.test(request.query.from) ? request.query.from : undefined;
        const to = typeof request.query.to === "string" && DATE_RE.test(request.query.to) ? request.query.to : undefined;
        const rangeError = validateDateRange({ from, to });
        if (rangeError) {
          response.status(400).json({ message: rangeError });
          return;
        }
        if (status && !WORK_STATUSES.includes(status)) {
          response.status(400).json({ message: "Invalid work request status" });
          return;
        }
        const kind = request.query.kind === "booking" || request.query.kind === "service" ? request.query.kind : undefined;
        const search = typeof request.query.search === "string" ? request.query.search.slice(0, 100) : undefined;
        const report = await ReportService.workRequests({ from, to, status: status || undefined, kind, search });
        response.send({ ...report, generatedAt, filters: { from, to, status: status || undefined, kind, search } });
        return;
      }

      const filters = parseTransactionFilters(request.query);
      const rangeError = validateDateRange(filters);
      if (rangeError) {
        response.status(400).json({ message: rangeError });
        return;
      }

      if (type === "collections") {
        const { paymentStatus: _paymentStatus, receipt: _receipt, ...collectionFilters } = filters;
        const report = await ReportService.collections(collectionFilters);
        response.send({ ...report, generatedAt, filters: collectionFilters });
        return;
      }

      if (type === "payments") {
        const { paymentStatus: _ignored, ...paymentFilters } = filters;
        const report = await ReportService.payments(paymentFilters);
        response.send({ ...report, generatedAt, filters: paymentFilters });
        return;
      }

      if (status && !DOCUMENT_STATUSES.includes(status)) {
        response.status(400).json({ message: "Invalid document request status" });
        return;
      }
      const report = await ReportService.documents({ ...filters, status: status || undefined });
      response.send({ ...report, generatedAt, filters: { ...filters, status: status || undefined } });
    } catch (error) {
      console.error("[REPORT GENERATE ERROR]", error);
      response.status(500).json({ message: "Failed to generate the report" });
    }
  };
}
