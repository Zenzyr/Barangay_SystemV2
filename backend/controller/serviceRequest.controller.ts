import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ServiceRequestService } from "../services/serviceRequest.service";
import { ContractService } from "../services/contract.service";
import { AccountService } from "../services/acccount.service";
import { UserActivityService } from "../services/userActivity.service";
import { NotificationService } from "../services/notification.service";
import { AuditLogService } from "../services/auditLog.service";
import { formattedDate } from "../utils/customFunc";
import { isObjectId, isNonEmptyString, MAX_DESCRIPTION_LENGTH } from "../utils/validation";
import { ScheduleError, WorkScheduleService, formatSlotLabel } from "../services/workSchedule.service";

export class ServiceRequestController {

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const client = request.account;
      if (!client) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { provider, skill, serviceType, description, scheduledDate, startTime, location, budget, notes } = request.body;

      if (!isObjectId(provider)) {
        response.status(400).send("A valid provider is required");
        return;
      }
      if (!isNonEmptyString(skill) || !isNonEmptyString(serviceType) || !isNonEmptyString(location)) {
        response.status(400).send("provider, skill, serviceType, and location are required");
        return;
      }
      if (!isNonEmptyString(description) || description.trim().length > MAX_DESCRIPTION_LENGTH) {
        response.status(400).send(`Description is required and must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
        return;
      }
      if (budget !== undefined && budget !== null && budget !== "" && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) {
        response.status(400).send("Budget must be a non-negative number");
        return;
      }

      if (skill.length > 100 || serviceType.trim().length > 100 || location.trim().length > 255) {
        response.status(400).send("Skill, service type, or location is too long");
        return;
      }
      if (notes !== undefined && notes !== null && String(notes).length > 500) {
        response.status(400).send("Notes must be at most 500 characters");
        return;
      }
      if (!scheduledDate || !startTime) {
        response.status(400).send("Please select a schedule date and an available time slot");
        return;
      }

      if (provider === client._id.toString()) {
        response.status(400).send("You cannot request a service from yourself");
        return;
      }

      const providerAccount = await AccountService.get(provider);
      if (!providerAccount || providerAccount.status !== "approved") {
        response.status(404).send("Provider not found");
        return;
      }

      if (providerAccount.availability !== "AVAILABLE") {
        response.status(400).send("This provider is not currently available for new requests");
        return;
      }

      const offeredSkill = providerAccount.skills?.find((s: any) => s.skill === skill);
      if (!offeredSkill) {
        response.status(400).send("This provider does not offer the selected skill");
        return;
      }

      let slot;
      try {
        slot = await WorkScheduleService.reserve(provider, scheduledDate, startTime);
      } catch (error) {
        if (error instanceof ScheduleError) {
          response.status(error.status).send(error.message);
          return;
        }
        throw error;
      }

      let serviceRequest;
      try {
        serviceRequest = await ServiceRequestService.create({
          client: client._id.toString(),
          provider,
          skill,
          serviceType,
          description: description.trim(),
          preferredDate: slot.date,
          preferredTime: formatSlotLabel(slot.startTime, slot.endTime),
          location,
          budget,
          notes,
          status: "PENDING",
          scheduledDate: slot.date,
          scheduleStartTime: slot.startTime,
          scheduleEndTime: slot.endTime,
          scheduleSlot: slot._id.toString(),
        });
      } catch (error) {
        await WorkScheduleService.release(slot._id);
        throw error;
      }

      await UserActivityService.create({
        accountId: client._id.toString(),
        activity: `Requested service: ${serviceType}`,
        date: formattedDate(),
      });

      const when = `${new Date(`${slot.date}T00:00:00`).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}, ${formatSlotLabel(slot.startTime, slot.endTime)}`;
      NotificationService.create({
        accountId: provider,
        title: "New Service Request",
        message: `${client.name} requested "${serviceType}" scheduled on ${when}. Review it from your Work Requests.`,
        type: "work",
      }).catch(() => null);
      AuditLogService.create({
        actor: client.name || "Resident",
        actorId: client._id.toString(),
        action: "create",
        entity: "workRequest",
        entityId: serviceRequest._id.toString(),
        entityLabel: serviceType,
        field: "status",
        newValue: "PENDING",
      }).catch(() => null);

      response.status(201).send(serviceRequest);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to create service request");
    }
  };

  static getMine = async (request: AuthRequest, response: Response) => {
    try {
      const client = request.account;
      if (!client) {
        response.status(401).send("User not authenticated");
        return;
      }
      const requests = await ServiceRequestService.getByClient(client._id.toString());
      response.send(requests);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch your service requests");
    }
  };

  static getReceived = async (request: AuthRequest, response: Response) => {
    try {
      const provider = request.account;
      if (!provider) {
        response.status(401).send("User not authenticated");
        return;
      }
      const requests = await ServiceRequestService.getByProvider(provider._id.toString());
      response.send(requests);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch received service requests");
    }
  };

  static accept = async (request: AuthRequest, response: Response) => {
    try {
      const provider = request.account;
      if (!provider) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid service request id");
        return;
      }
      const serviceRequest = await ServiceRequestService.get(id);

      if (!serviceRequest) {
        response.status(404).send("Service request not found");
        return;
      }

      if (serviceRequest.provider._id.toString() !== provider._id.toString()) {
        response.status(403).send("You are not authorized to act on this request");
        return;
      }

      if (serviceRequest.status !== "PENDING") {
        response.status(400).send(`Request has already been ${serviceRequest.status.toLowerCase()}`);
        return;
      }

      const providerAccount = await AccountService.get(provider._id.toString());
      if (!providerAccount || providerAccount.availability !== "AVAILABLE") {
        response.status(400).send("You must be AVAILABLE to accept a new request. Complete or cancel your current active service first.");
        return;
      }

      const accepted = await ServiceRequestService.updateStatusIf(id, "PENDING", "ACCEPTED");
      if (!accepted) {
        response.status(409).send("This request was already updated. Please reload and try again.");
        return;
      }

      let contract;
      try {
        contract = await ContractService.create({
          serviceRequest: id,
          client: serviceRequest.client._id.toString(),
          provider: provider._id.toString(),
          skill: serviceRequest.skill,
          serviceType: serviceRequest.serviceType,
          description: serviceRequest.description,
          agreedPrice: serviceRequest.budget,
          startDate: serviceRequest.preferredDate,
          location: serviceRequest.location,
          notes: serviceRequest.notes,
          status: "ACTIVE",
        });
      } catch (error) {
        await ServiceRequestService.updateStatusIf(id, "ACCEPTED", "PENDING");
        throw error;
      }

      await AccountService.updateAvailability(provider._id.toString(), "BUSY");

      await UserActivityService.create({
        accountId: provider._id.toString(),
        activity: `Accepted service request: ${serviceRequest.serviceType}`,
        date: formattedDate(),
      });

      NotificationService.create({
        accountId: serviceRequest.client._id.toString(),
        title: "Service Request Accepted",
        message: `${provider.name} accepted your "${serviceRequest.serviceType}" request. A service contract has been created.`,
        type: "work",
      }).catch(() => null);
      AuditLogService.create({
        actor: provider.name || "Resident",
        actorId: provider._id.toString(),
        action: "update",
        entity: "workRequest",
        entityId: id,
        entityLabel: serviceRequest.serviceType,
        field: "status",
        previousValue: serviceRequest.status,
        newValue: "ACCEPTED",
      }).catch(() => null);

      response.send({ message: "Request accepted", contract });
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to accept service request");
    }
  };

  static reject = async (request: AuthRequest, response: Response) => {
    try {
      const provider = request.account;
      if (!provider) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid service request id");
        return;
      }
      const serviceRequest = await ServiceRequestService.get(id);

      if (!serviceRequest) {
        response.status(404).send("Service request not found");
        return;
      }

      if (serviceRequest.provider._id.toString() !== provider._id.toString()) {
        response.status(403).send("You are not authorized to act on this request");
        return;
      }

      if (serviceRequest.status !== "PENDING") {
        response.status(400).send(`Request has already been ${serviceRequest.status.toLowerCase()}`);
        return;
      }

      const rejected = await ServiceRequestService.updateStatusIf(id, "PENDING", "REJECTED");
      if (!rejected) {
        response.status(409).send("This request was already updated. Please reload and try again.");
        return;
      }
      if ((serviceRequest as any).scheduleSlot) {
        await WorkScheduleService.release((serviceRequest as any).scheduleSlot);
      }

      NotificationService.create({
        accountId: serviceRequest.client._id.toString(),
        title: "Service Request Declined",
        message: `${provider.name} declined your "${serviceRequest.serviceType}" request. You can request another provider.`,
        type: "work",
      }).catch(() => null);
      AuditLogService.create({
        actor: provider.name || "Resident",
        actorId: provider._id.toString(),
        action: "update",
        entity: "workRequest",
        entityId: id,
        entityLabel: serviceRequest.serviceType,
        field: "status",
        previousValue: serviceRequest.status,
        newValue: "REJECTED",
      }).catch(() => null);

      response.send({ message: "Request rejected" });
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to reject service request");
    }
  };

  static cancel = async (request: AuthRequest, response: Response) => {
    try {
      const client = request.account;
      if (!client) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid service request id");
        return;
      }
      const serviceRequest = await ServiceRequestService.get(id);

      if (!serviceRequest) {
        response.status(404).send("Service request not found");
        return;
      }

      if (serviceRequest.client._id.toString() !== client._id.toString()) {
        response.status(403).send("You are not authorized to act on this request");
        return;
      }

      if (serviceRequest.status !== "PENDING") {
        response.status(400).send(`Request has already been ${serviceRequest.status.toLowerCase()}`);
        return;
      }

      const cancelled = await ServiceRequestService.updateStatusIf(id, "PENDING", "CANCELLED");
      if (!cancelled) {
        response.status(409).send("This request was already updated. Please reload and try again.");
        return;
      }
      if ((serviceRequest as any).scheduleSlot) {
        await WorkScheduleService.release((serviceRequest as any).scheduleSlot);
      }

      await UserActivityService.create({
        accountId: client._id.toString(),
        activity: `Cancelled service request: ${serviceRequest.serviceType}`,
        date: formattedDate(),
      });

      NotificationService.create({
        accountId: serviceRequest.provider._id.toString(),
        title: "Service Request Cancelled",
        message: `${client.name} cancelled their "${serviceRequest.serviceType}" request. The reserved time slot has been released.`,
        type: "work",
      }).catch(() => null);
      AuditLogService.create({
        actor: client.name || "Resident",
        actorId: client._id.toString(),
        action: "cancel",
        entity: "workRequest",
        entityId: id,
        entityLabel: serviceRequest.serviceType,
        field: "status",
        previousValue: serviceRequest.status,
        newValue: "CANCELLED",
      }).catch(() => null);

      response.send({ message: "Request cancelled" });
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to cancel service request");
    }
  };
}
