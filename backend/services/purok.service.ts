import PurokModel from "../model/purok.model";
import AccountModel from "../model/account.model";
import { purokInterfaceInput } from "../types/purok.type";

export class PurokService {
  static async create(data: purokInterfaceInput) {
    return await PurokModel.create(data);
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await PurokModel.find(filter).sort({ name: 1 });
  }

  static async get(id: string) {
    return await PurokModel.findById(id);
  }

  static async update(id: string, data: Partial<purokInterfaceInput>) {
    return await PurokModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async delete(id: string) {
    return await PurokModel.findByIdAndDelete(id);
  }

  /**
   * Residents whose purok field matches the given purok name. Pulls from the
   * accounts collection (approved residents) so the UI can show who belongs to
   * a purok.
   */
  static async getResidents(purokName: string) {
    return await AccountModel.find({ purok: purokName }).select(
      "-password -idImg.idFront -idImg.idBack -idImg.idSelfie"
    );
  }

  /**
   * Resident census rows linked to a purok by name.
   */
  static async getCensus(purokName: string) {
    const { default: CensusModel } = await import("../model/residentCensus.model");
    return await CensusModel.find({ purok: purokName });
  }
}