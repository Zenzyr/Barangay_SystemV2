import ResidentCensusModel from "../model/residentCensus.model";
import { residentCensusInterfaceInput } from "../types/residentCensus.type";

export class ResidentCensusService {

  static async create(data: residentCensusInterfaceInput) {
    return await ResidentCensusModel.create(data);
  }

  static async getAll(filter: Record<string, any> = {}) {
    return await ResidentCensusModel.find(filter).sort({ purok: 1, householdNumber: 1 });
  }

  static async get(id: string) {
    return await ResidentCensusModel.findById(id);
  }

  static async update(id: string, data: Partial<residentCensusInterfaceInput>) {
    return await ResidentCensusModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async delete(id: string) {
    return await ResidentCensusModel.findByIdAndDelete(id);
  }
}
