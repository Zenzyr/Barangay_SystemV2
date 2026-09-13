import BarangaySettingsModel from "../model/barangaySettings.model";
import { DEFAULT_BARANGAY_SETTINGS, barangaySettingsInterfaceInput } from "../types/barangaySettings.type";

export class BarangaySettingsService {
  /**
   * Returns the single settings document, creating an empty one on first use.
   * Lean so controllers can attach the mongo `_id` as a plain string.
   */
  static async get() {
    let doc = await BarangaySettingsModel.findOne().lean();
    if (!doc) {
      doc = await BarangaySettingsModel.create(DEFAULT_BARANGAY_SETTINGS);
    }
    return doc;
  }

  static async upsert(data: Partial<barangaySettingsInterfaceInput>) {
    let doc = await BarangaySettingsModel.findOne();
    if (!doc) {
      return await BarangaySettingsModel.create({
        ...DEFAULT_BARANGAY_SETTINGS,
        ...data,
      });
    }
    return await BarangaySettingsModel.findByIdAndUpdate(doc._id, data, { new: true }).lean();
  }
}