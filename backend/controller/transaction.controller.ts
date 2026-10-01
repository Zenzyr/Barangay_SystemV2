import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import {
  TransactionService,
  parseTransactionFilters,
  validateDateRange,
} from "../services/transaction.service";
import { isObjectId } from "../utils/validation";
import { isStaffRole } from "../utils/roles";

const parsePaging = (query: Record<string, any>) => ({
  page: Number(query.page) || 1,
  limit: Number(query.limit) || 20,
  sortBy: ["date", "amount", "resident", "document"].includes(String(query.sortBy))
    ? (query.sortBy as "date" | "amount" | "resident" | "document")
    : "date",
  sortDir: query.sortDir === "asc" ? ("asc" as const) : ("desc" as const),
});

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
      const result = await TransactionService.getReceipt(
        id,
        (ownerId) => isStaffRole(account.role) || ownerId === accountId,
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
}
