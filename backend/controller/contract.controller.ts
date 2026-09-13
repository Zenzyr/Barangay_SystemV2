import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ContractService } from "../services/contract.service";
import { AccountService } from "../services/acccount.service";
import { UserActivityService } from "../services/userActivity.service";
import { formattedDate } from "../utils/customFunc";
import { isObjectId } from "../utils/validation";

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
      response.send(contract);
    } catch (error) {
      console.error(error);
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

      await UserActivityService.create({
        accountId: provider._id.toString(),
        activity: `Requested completion for: ${contract.serviceType}`,
        date: formattedDate(),
      });

      response.send(updated);
    } catch (error) {
      console.error(error);
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
      await AccountService.incrementCompletedServices(contract.provider._id.toString());
      await AccountService.updateAvailability(contract.provider._id.toString(), "AVAILABLE");

      await UserActivityService.create({
        accountId: client._id.toString(),
        activity: `Confirmed completion for: ${contract.serviceType}`,
        date: formattedDate(),
      });

      response.send(updated);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to confirm completion");
    }
  };
}
