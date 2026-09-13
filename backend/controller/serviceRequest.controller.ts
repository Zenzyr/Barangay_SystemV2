import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ServiceRequestService } from "../services/serviceRequest.service";
import { ContractService } from "../services/contract.service";
import { AccountService } from "../services/acccount.service";
import { UserActivityService } from "../services/userActivity.service";
import { formattedDate } from "../utils/customFunc";
import { isObjectId, isNonEmptyString, MAX_DESCRIPTION_LENGTH } from "../utils/validation";

export class ServiceRequestController {

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const client = request.account;
      if (!client) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { provider, skill, serviceType, description, preferredDate, preferredTime, location, budget, notes } = request.body;

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
      if (budget !== undefined && budget !== null && budget !== "" && (typeof Number(budget) !== "number" || Number(budget) < 0)) {
        response.status(400).send("Budget must be a non-negative number");
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

      const serviceRequest = await ServiceRequestService.create({
        client: client._id.toString(),
        provider,
        skill,
        serviceType,
        description,
        preferredDate,
        preferredTime,
        location,
        budget,
        notes,
        status: "PENDING",
      });

      await UserActivityService.create({
        accountId: client._id.toString(),
        activity: `Requested service: ${serviceType}`,
        date: formattedDate(),
      });

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

      await ServiceRequestService.updateStatus(id, "ACCEPTED");

      const contract = await ContractService.create({
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

      await AccountService.updateAvailability(provider._id.toString(), "BUSY");

      await UserActivityService.create({
        accountId: provider._id.toString(),
        activity: `Accepted service request: ${serviceRequest.serviceType}`,
        date: formattedDate(),
      });

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

      await ServiceRequestService.updateStatus(id, "REJECTED");

      response.send({ message: "Request rejected" });
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to reject service request");
    }
  };
}
