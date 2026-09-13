import SystemInfoModel from "../model/systemInfo.model"
import { systemInfoInterface, systemInfoInterfaceInput } from "../types/systemInfo";

export class SystemInfoService {

  static async create(data: systemInfoInterfaceInput) {
    return await SystemInfoModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    const infos = SystemInfoModel.find(filter);
    return infos
  }

  static async get(id: string) {
    const info = SystemInfoModel.findById(id);
    return info
  }

  static async delete(id: string) {
    const info = SystemInfoModel.findByIdAndDelete(id);
    return info
  }

  static async update(id: string, data: Partial<systemInfoInterface>) {
    return await SystemInfoModel.findByIdAndUpdate(id, data, { new: true });
  }

  static async getFirst() {
    const info = await SystemInfoModel.findOne().lean();
    return JSON.stringify(info);
  }

  static async upsert(data: systemInfoInterfaceInput) {
    const existing = await SystemInfoModel.findOne();
    if (existing) {
      return await SystemInfoModel.findByIdAndUpdate(existing._id, data, { new: true });
    }
    return await SystemInfoModel.create(data);
  }
}
