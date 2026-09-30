import AccountModel from "../model/account.model";
import DocumentRequestModel from "../model/documentRequest.model";
import BusinessModel from "../model/business.model";

export class PublicStatsService {
  static async getStats() {
    const [activeResidents, processedDocuments, skilledNeighbors] = await Promise.all([
      AccountModel.countDocuments({ status: "approved" }),
      // "released" is the current terminal status; "completed" is legacy.
      DocumentRequestModel.countDocuments({ status: { $in: ["released", "completed"] } }),
      AccountModel.countDocuments({ "skills.0": { $exists: true } }),
    ]);

    return {
      activeResidents,
      processedDocuments,
      skilledNeighbors,
    };
  }
}
