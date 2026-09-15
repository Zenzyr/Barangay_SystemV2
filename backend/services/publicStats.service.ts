import AccountModel from "../model/account.model";
import DocumentRequestModel from "../model/documentRequest.model";
import BusinessModel from "../model/business.model";

export class PublicStatsService {
  static async getStats() {
    const [activeResidents, processedDocuments, skilledNeighbors] = await Promise.all([
      AccountModel.countDocuments({ status: "approved" }),
      DocumentRequestModel.countDocuments({ status: "completed" }),
      AccountModel.countDocuments({ "skills.0": { $exists: true } }),
    ]);

    return {
      activeResidents,
      processedDocuments,
      skilledNeighbors,
    };
  }
}
