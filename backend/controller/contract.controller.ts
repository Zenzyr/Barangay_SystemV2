import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ContractService } from "../services/contract.service";
import { ServiceRequestService } from "../services/serviceRequest.service";
import { AccountService } from "../services/acccount.service";
import { UserActivityService } from "../services/userActivity.service";
import { NotificationService } from "../services/notification.service";
import { AuditLogService } from "../services/auditLog.service";
import { WorkScheduleService } from "../services/workSchedule.service";
import { formattedDate } from "../utils/customFunc";
import { isObjectId } from "../utils/validation";
import { isStaffRole } from "../utils/roles";

/** Client, provider, or barangay staff may read a contract. */
const canViewContract = (contract: any, account: any) => {
  const accountId = account._id.toString();
  return (
    contract.client?._id?.toString() === accountId ||
    contract.provider?._id?.toString() === accountId ||
    isStaffRole(account.role)
  );
};

export class ContractController {

  static getMine = async (request: AuthRequest, response: Response) => {
    try {
      const client = request.account;
      if (!client) {
        response.status(401).send("User not authenticated");
        return;
      }
      const contracts = await ContractService.getByClient(client._id.toString());
      response.send(contracts);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch your contracts");
    }
  };

  static getProvider = async (request: AuthRequest, response: Response) => {
    try {
      const provider = request.account;
      if (!provider) {
        response.status(401).send("User not authenticated");
        return;
      }
      const contracts = await ContractService.getByProvider(provider._id.toString());
      response.send(contracts);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch your active services");
    }
  };

  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid contract id");
        return;
      }
      const contract = await ContractService.get(id);
      if (!contract) {
        response.status(404).send("Contract not found");
        return;
      }
      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }
      if (!canViewContract(contract, account)) {
        response.status(403).send("You can only view your own contracts");
        return;
      }
      response.send(contract);
    } catch (error) {
      response.status(500).send("Failed to fetch contract");
    }
  };

  // Provider marks the work as done, awaiting client confirmation.
  static requestCompletion = async (request: AuthRequest, response: Response) => {
    try {
      const provider = request.account;
      if (!provider) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid contract id");
        return;
      }
      const contract = await ContractService.get(id);

      if (!contract) {
        response.status(404).send("Contract not found");
        return;
      }

      if (contract.provider._id.toString() !== provider._id.toString()) {
        response.status(403).send("You are not authorized to act on this contract");
        return;
      }

      if (contract.status !== "ACTIVE") {
        response.status(400).send(`Contract must be ACTIVE to request completion (current status: ${contract.status})`);
        return;
      }

      const updated = await ContractService.requestCompletion(id);
      if (!updated) {
        response.status(409).send("This contract was already updated. Please reload and try again.");
        return;
      }

      await UserActivityService.create({
        accountId: provider._id.toString(),
        activity: `Requested completion for: ${contract.serviceType}`,
        date: formattedDate(),
      });

      NotificationService.create({
        accountId: contract.client._id.toString(),
        title: "Completion Requested",
        message: `${provider.name} marked "${contract.serviceType}" as done. Confirm completion to finish the service.`,
        type: "work",
      }).catch(() => null);
      AuditLogService.create({
        actor: provider.name || "Resident",
        actorId: provider._id.toString(),
        action: "update",
        entity: "contract",
        entityId: id,
        entityLabel: contract.serviceType,
        field: "status",
        previousValue: contract.status,
        newValue: "COMPLETION_REQUESTED",
      }).catch(() => null);

      response.send(updated);
    } catch (error) {
      response.status(500).send("Failed to request completion");
    }
  };

  // Client confirms the service was actually completed.
  static confirmCompletion = async (request: AuthRequest, response: Response) => {
    try {
      const client = request.account;
      if (!client) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid contract id");
        return;
      }
      const contract = await ContractService.get(id);

      if (!contract) {
        response.status(404).send("Contract not found");
        return;
      }

      if (contract.client._id.toString() !== client._id.toString()) {
        response.status(403).send("You are not authorized to act on this contract");
        return;
      }

      if (contract.status !== "COMPLETION_REQUESTED") {
        response.status(400).send(`The provider must request completion before you can confirm it (current status: ${contract.status})`);
        return;
      }

      const updated = await ContractService.confirmCompletion(id);
      if (!updated) {
        response.status(409).send("This contract was already updated. Please reload and try again.");
        return;
      }
      await AccountService.incrementCompletedServices(contract.provider._id.toString());
      await AccountService.updateAvailability(contract.provider._id.toString(), "AVAILABLE");

      // Keep the originating ServiceRequest in sync so it no longer counts as
      // an "open"/accepted request and can no longer be rescheduled.
      const serviceRequestId = (contract as any).serviceRequest?._id?.toString?.() ?? String((contract as any).serviceRequest);
      await ServiceRequestService.updateStatusIf(serviceRequestId, "ACCEPTED", "COMPLETED").catch(() => null);

      await UserActivityService.create({
        accountId: client._id.toString(),
        activity: `Confirmed completion for: ${contract.serviceType}`,
        date: formattedDate(),
      });

      NotificationService.create({
        accountId: contract.provider._id.toString(),
        title: "Service Completed",
        message: `The client confirmed completion of "${contract.serviceType}". Thank you!`,
        type: "work",
      }).catch(() => null);
      AuditLogService.create({
        actor: client.name || "Resident",
        actorId: client._id.toString(),
        action: "update",
        entity: "contract",
        entityId: id,
        entityLabel: contract.serviceType,
        field: "status",
        previousValue: contract.status,
        newValue: "COMPLETED",
      }).catch(() => null);

      response.send(updated);
    } catch (error) {
      response.status(500).send("Failed to confirm completion");
    }
  };

  // Either party (or staff) cancels an active contract; frees the schedule slot
  // and returns the provider to AVAILABLE.
  static cancel = async (request: AuthRequest, response: Response) => {
    try {
      const account = request.account;
      if (!account) {
        response.status(401).send("Authentication required");
        return;
      }

      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid contract id");
        return;
      }

      const contract = await ContractService.get(id);
      if (!contract) {
        response.status(404).send("Contract not found");
        return;
      }

      const isClient = contract.client._id.toString() === account._id.toString();
      const isProvider = contract.provider._id.toString() === account._id.toString();
      if (!isClient && !isProvider && !isStaffRole(account.role)) {
        response.status(403).send("You are not authorized to cancel this contract");
        return;
      }
      if (contract.status !== "ACTIVE" && contract.status !== "COMPLETION_REQUESTED") {
        response.status(400).send(`Only active contracts can be cancelled (current status: ${contract.status})`);
        return;
      }

      const cancelled = await ContractService.cancelIf(id);
      if (!cancelled) {
        response.status(409).send("This contract was already updated. Please reload and try again.");
        return;
      }

      const serviceRequest: any = await ServiceRequestService.get(
        String(contract.serviceRequest?._id || contract.serviceRequest),
      ).catch(() => null);
      if (serviceRequest?.scheduleSlot) {
        await WorkScheduleService.release(serviceRequest.scheduleSlot);
      }
      await ServiceRequestService.updateStatusIf(
        String(contract.serviceRequest?._id || contract.serviceRequest),
        "ACCEPTED",
        "CANCELLED",
      ).catch(() => null);
      await AccountService.updateAvailability(contract.provider._id.toString(), "AVAILABLE");

      await UserActivityService.create({
        accountId: account._id.toString(),
        activity: `Cancelled contract: ${contract.serviceType}`,
        date: formattedDate(),
      });

      const counterpart = isClient
        ? contract.provider._id.toString()
        : contract.client._id.toString();
      NotificationService.create({
        accountId: counterpart,
        title: "Contract Cancelled",
        message: `The contract for "${contract.serviceType}" was cancelled by ${account.name || "a resident"}.`,
        type: "work",
      }).catch(() => null);
      AuditLogService.create({
        actor: account.name || "Resident",
        actorId: account._id.toString(),
        action: "cancel",
        entity: "contract",
        entityId: id,
        entityLabel: contract.serviceType,
        field: "status",
        previousValue: contract.status,
        newValue: "CANCELLED",
      }).catch(() => null);

      response.send(cancelled);
    } catch (error) {
      console.error("[CONTRACT CANCEL ERROR]", error);
      response.status(500).send("Failed to cancel the contract");
    }
  };
}
