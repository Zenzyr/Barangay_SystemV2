import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { SuspensionAppealService } from "../services/suspensionAppeal.service";
import { AccountService } from "../services/acccount.service";
import { NotificationService } from "../services/notification.service";
import { AuditLogService } from "../services/auditLog.service";
import { sendEmail } from "../utils/email";
import { isObjectId, isNonEmptyString, withinLength, MAX_TEXT_LENGTH } from "../utils/validation";

export class SuspensionAppealController {
  static submit = async (request: AuthRequest, response: Response) => {
    try {
      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }

      const freshAccount = await AccountService.get(account._id);
      if (!freshAccount?.isSuspended) {
        response.status(400).send("Only a suspended account may submit an appeal");
        return;
      }

      const reason = String(request.body?.reason || "").trim();
      if (!isNonEmptyString(reason)) {
        response.status(400).send("Please explain why your suspension should be reviewed");
        return;
      }
      if (!withinLength(reason, MAX_TEXT_LENGTH)) {
        response.status(400).send(`Appeal reason must be at most ${MAX_TEXT_LENGTH} characters`);
        return;
      }

      const appeal = await SuspensionAppealService.create({
        accountId: account._id,
        reason,
        status: "pending",
      });

      AuditLogService.create({
        actor: freshAccount.name,
        actorId: account._id,
        action: "appeal_submit",
        entity: "account",
        entityId: account._id,
        entityLabel: freshAccount.name,
      }).catch(() => null);

      response.status(201).send(appeal);
    } catch (error) {
      console.error("[SUBMIT APPEAL ERROR]", error);
      response.status(500).send("Failed to submit appeal");
    }
  };

  static mine = async (request: AuthRequest, response: Response) => {
    try {
      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }
      const appeals = await SuspensionAppealService.getByAccount(account._id);
      response.send(appeals);
    } catch (error) {
      console.error("[GET MY APPEALS ERROR]", error);
      response.status(500).send("Failed to fetch appeals");
    }
  };

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { status } = request.query;
      const filter: Record<string, any> = {};
      if (status) filter.status = status;
      const appeals = await SuspensionAppealService.getAll(filter);

      const accountIds = [...new Set(appeals.map((a) => a.accountId))];
      const accounts = await Promise.all(accountIds.map((id) => AccountService.get(id)));
      const accountById = new Map(accounts.filter(Boolean).map((a: any) => [a._id.toString(), a]));

      const enriched = appeals.map((a) => {
        const acc: any = accountById.get(a.accountId);
        return {
          ...a.toObject(),
          account: acc
            ? { _id: acc._id, name: acc.name, email: acc.email, suspensionReason: acc.suspensionReason }
            : null,
        };
      });

      response.send(enriched);
    } catch (error) {
      console.error("[GET ALL APPEALS ERROR]", error);
      response.status(500).send("Failed to fetch appeals");
    }
  };

  static review = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { status, decisionNote } = request.body || {};

      if (!isObjectId(id)) {
        response.status(400).send("Invalid appeal id");
        return;
      }
      if (!["under_review", "approved", "rejected"].includes(status)) {
        response.status(400).send("Status must be under_review, approved, or rejected");
        return;
      }

      const appeal = await SuspensionAppealService.get(id);
      if (!appeal) {
        response.status(404).send("Appeal not found");
        return;
      }

      const reviewer = request.account;
      const updated = await SuspensionAppealService.updateStatus(
        id,
        status,
        reviewer?.name || "Super Admin",
        decisionNote ? String(decisionNote).trim() : undefined,
      );

      const targetAccount = await AccountService.get(appeal.accountId);

      if (status === "approved" && targetAccount) {
        await AccountService.update(appeal.accountId, {
          isSuspended: false,
          suspendedBy: "",
          suspensionReason: "",
        });
      }

      if (targetAccount) {
        AuditLogService.create({
          actor: reviewer?.name || "Super Admin",
          actorId: reviewer?._id || "",
          action: `appeal_${status}`,
          entity: "account",
          entityId: targetAccount._id.toString(),
          entityLabel: targetAccount.name,
        }).catch(() => null);

        const message =
          status === "approved"
            ? "Your appeal was approved. Your account access has been restored."
            : status === "rejected"
            ? "Your appeal was reviewed and rejected. Your account remains suspended."
            : "Your appeal is now under review.";

        NotificationService.create({
          accountId: targetAccount._id.toString(),
          title: "Suspension appeal update",
          message,
          type: "security",
        }).catch(() => null);

        sendEmail(targetAccount.email, "Update on your account suspension appeal", `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1f2937;">
            <h2>Suspension Appeal Update</h2>
            <p>${message}</p>
            ${decisionNote ? `<p><strong>Note from the barangay:</strong> ${String(decisionNote).replace(/[<>&]/g, "")}</p>` : ""}
          </div>
        `).catch(() => null);
      }

      response.send(updated);
    } catch (error) {
      console.error("[REVIEW APPEAL ERROR]", error);
      response.status(500).send("Failed to review appeal");
    }
  };
}
