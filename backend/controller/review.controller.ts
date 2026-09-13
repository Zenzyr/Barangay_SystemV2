import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { ReviewService } from "../services/review.service";
import { ContractService } from "../services/contract.service";
import { AccountService } from "../services/acccount.service";
import { UserActivityService } from "../services/userActivity.service";
import { formattedDate } from "../utils/customFunc";
import { isObjectId, isNonEmptyString, MAX_TEXT_LENGTH } from "../utils/validation";

export class ReviewController {

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const client = request.account;
      if (!client) {
        response.status(401).send("User not authenticated");
        return;
      }

      const { contractId, star, message } = request.body;

      if (!isObjectId(contractId)) {
        response.status(400).send("A valid contract is required");
        return;
      }
      if (star === undefined || typeof Number(star) !== "number" || Number(star) < 1 || Number(star) > 5) {
        response.status(400).send("Star rating must be between 1 and 5");
        return;
      }
      if (!isNonEmptyString(message) || message.trim().length > MAX_TEXT_LENGTH) {
        response.status(400).send(`Review message is required and must be at most ${MAX_TEXT_LENGTH} characters`);
        return;
      }

      const contract = await ContractService.get(contractId);
      if (!contract) {
        response.status(404).send("Contract not found");
        return;
      }

      // ── Security checks (per spec §14) ──────────────────────────
      if (contract.client._id.toString() !== client._id.toString()) {
        response.status(403).send("Only the client of this contract can leave a review");
        return;
      }

      if (contract.status !== "COMPLETED") {
        response.status(400).send("You can only review a service after it has been completed and confirmed");
        return;
      }

      const existingReview = await ReviewService.getByContract(contractId);
      if (existingReview) {
        response.status(400).send("A review has already been submitted for this contract");
        return;
      }

      const review = await ReviewService.create({
        contract: contractId,
        client: client._id.toString(),
        provider: contract.provider._id.toString(),
        skill: contract.skill,
        star: Number(star),
        message,
      });

      // Keep the existing denormalized reviews[] cache on the provider's
      // Account in sync, so existing display components (average rating,
      // review list) continue to work unchanged.
      const clientAccount = await AccountService.get(client._id.toString());
      await AccountService.addReview(contract.provider._id.toString(), {
        user: clientAccount?.name || "Resident",
        userProfile: clientAccount?.profile || "",
        star: Number(star),
        skill: contract.skill,
        message,
      });

      await UserActivityService.create({
        accountId: client._id.toString(),
        activity: `Left a review for: ${contract.serviceType}`,
        date: formattedDate(),
      });

      response.status(201).send(review);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to submit review");
    }
  };

  static getByProvider = async (request: AuthRequest, response: Response) => {
    try {
      const { providerId } = request.params;
      if (!isObjectId(providerId)) {
        response.status(400).send("Invalid provider id");
        return;
      }
      const reviews = await ReviewService.getByProvider(providerId);
      response.send(reviews);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to fetch reviews");
    }
  };

  static checkExists = async (request: AuthRequest, response: Response) => {
    try {
      const { contractId } = request.params;
      if (!isObjectId(contractId)) {
        response.status(400).send("Invalid contract id");
        return;
      }
      const review = await ReviewService.getByContract(contractId);
      response.send({ exists: !!review, review: review || null });
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to check review status");
    }
  };
}
