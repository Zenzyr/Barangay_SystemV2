import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  TransactionService,
  parseTransactionFilters,
  validateDateRange,
} from "../services/transaction.service";
import { isObjectId } from "../utils/validation";
import { PERMISSIONS, hasPermission } from "../utils/roles";
import { AuditLogService } from "../services/auditLog.service";
import { documentDisplayName } from "../utils/documentNames";

const parsePaging = (query: Record<string, any>) => ({
  page: Number(query.page) || 1,
  limit: Number(query.limit) || 20,
  sortBy: ["date", "amount", "resident", "document"].includes(String(query.sortBy))
    ? (query.sortBy as "date" | "amount" | "resident" | "document")
    : "date",
  sortDir: query.sortDir === "asc" ? ("asc" as const) : ("desc" as const),
});

const actorOf = (request: AuthRequest) => ({
  id: request.account!._id.toString(),
  name: request.account!.name || "Treasurer",
});

const auditLabel = (doc: any) => {
  const resident = doc.resident && typeof doc.resident === "object" ? doc.resident.name : null;
  return [doc.receiptNumber || `REQ-${String(doc._id).slice(-6).toUpperCase()}`, resident || doc.fullName, documentDisplayName(doc.document)]
    .filter(Boolean)
    .join(" · ");
};

const audit = (request: AuthRequest, doc: any, action: string, field: string, previousValue: unknown, newValue: unknown) =>
  AuditLogService.create({
    actor: request.account?.name ?? "System",
    actorId: request.account?._id?.toString?.() ?? "",
    action,
    entity: "payment",
    entityId: String(doc._id),
    entityLabel: auditLabel(doc),
    field,
    previousValue,
    newValue,
  }).catch(() => null);

export class TransactionController {

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const filters = parseTransactionFilters(request.query);
      const rangeError = validateDateRange(filters);
      if (rangeError) {
        response.status(400).json({ message: rangeError });
        return;
      }
      const result = await TransactionService.list({ ...filters, ...parsePaging(request.query) });
      response.send(result);
    } catch (error) {
      console.error("[TRANSACTIONS LIST ERROR]", error);
      response.status(500).json({ message: "Failed to fetch transactions" });
    }
  };

  static getMine = async (request: AuthRequest, response: Response) => {
    try {
      const account = request.account;
      if (!account) {
        response.status(401).json({ message: "Authentication required" });
        return;
      }
      const filters = parseTransactionFilters(request.query);
      const rangeError = validateDateRange(filters);
      if (rangeError) {
        response.status(400).json({ message: rangeError });
        return;
      }
      const result = await TransactionService.list({
        ...filters,
        ...parsePaging(request.query),
        resident: account._id.toString(),
      });
      response.send(result);
    } catch (error) {
      console.error("[TRANSACTIONS MINE ERROR]", error);
      response.status(500).json({ message: "Failed to fetch your transactions" });
    }
  };

  static getReceipt = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).json({ message: "Invalid transaction id" });
        return;
      }
      const account = request.account;
      if (!account) {
        response.status(401).json({ message: "Authentication required" });
        return;
      }

      const accountId = account._id.toString();
      const canViewAny = hasPermission(account.role, PERMISSIONS.RECEIPTS_VIEW);
      const result = await TransactionService.getReceipt(
        id,
        (ownerId) => canViewAny || ownerId === accountId,
        { allowVoided: canViewAny },
      );
      if (result.status === 404) {
        response.status(404).json({ message: "Transaction not found" });
        return;
      }
      if (result.status === 403) {
        response.status(403).json({ message: "You can only view receipts for your own transactions" });
        return;
      }

      if (result.status === 400) {
        response.status(400).json({ message: "This request has not been paid yet, so no receipt is available" });
        return;
      }

      response.send(result.receipt);
    } catch (error) {
      console.error("[TRANSACTION RECEIPT ERROR]", error);
      response.status(500).json({ message: "Failed to load the receipt" });
    }
  };

  static getResidentOptions = async (_request: AuthRequest, response: Response) => {
    try {
      response.send(await TransactionService.residentOptions());
    } catch (error) {
      console.error("[TRANSACTION RESIDENTS ERROR]", error);
      response.status(500).json({ message: "Failed to load residents" });
    }
  };

  static getSummary = async (_request: AuthRequest, response: Response) => {
    try {
      response.send(await TransactionService.dashboard());
    } catch (error) {
      console.error("[TRANSACTIONS SUMMARY ERROR]", error);
      response.status(500).json({ message: "Failed to load the collection summary" });
    }
  };

  static getDetail = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).json({ message: "Invalid transaction id" });
        return;
      }
      const detail = await TransactionService.getDetail(id);
      if (!detail) {
        response.status(404).json({ message: "Transaction not found" });
        return;
      }
      response.send(detail);
    } catch (error) {
      console.error("[TRANSACTION DETAIL ERROR]", error);
      response.status(500).json({ message: "Failed to load the transaction" });
    }
  };

  static logReprint = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).json({ message: "Invalid transaction id" });
        return;
      }
      const result = await TransactionService.logReceiptReprint(id, actorOf(request));
      if (result.status !== 200) {
        response.status(result.status).json({ message: result.message });
        return;
      }
      await audit(request, result.doc, "receipt_reprinted", "receiptNumber", null, result.doc.receiptNumber);
      response.send({ message: "Reprint recorded" });
    } catch (error) {
      console.error("[RECEIPT REPRINT LOG ERROR]", error);
      response.status(500).json({ message: "Failed to record the reprint" });
    }
  };
}
