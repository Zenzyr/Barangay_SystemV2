import ReviewModel from "../model/review.model";
import { reviewInterfaceInput } from "../types/review.type";

export class ReviewService {

  static async create(data: reviewInterfaceInput) {
    return await ReviewModel.create(data);
  }

  static async getByContract(contractId: string) {
    return await ReviewModel.findOne({ contract: contractId });
  }

  static async getByProvider(providerId: string) {
    return await ReviewModel.find({ provider: providerId })
      .populate("client", "-password")
      .sort({ createdAt: -1 });
  }
}
