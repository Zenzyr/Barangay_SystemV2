import BusinessModel from "../model/business.model"
import { businessInterface, businessInterfaceInput } from "../types/business.type";

export class BusinessService {

  static async create(data: businessInterfaceInput) {
    return await BusinessModel.create(data)
  }

  static async getAll(filter: Record<string, any> = {}) {
    const businesses = BusinessModel.find(filter).populate("resident", "-password").sort({ _id: -1 });
    return businesses
  }

  static async get(id: string) {
    const business = BusinessModel.findById(id).populate("resident", "-password");
    return business
  }

  static async delete(id: string) {
    const business = BusinessModel.findByIdAndDelete(id);
    return business
  }

  static async update(id: string, data: Partial<businessInterface>) {
    return await BusinessModel.findByIdAndUpdate(id, data, { new: true }).populate("resident", "-password");
  }

  static async updateStatus(id: string, status: string) {
    return await BusinessModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("resident", "-password");
  }

  static async getByResident(residentId: string) {
    const businesses = BusinessModel.find({ resident: residentId }).populate("resident", "-password").sort({ _id: -1 });
    return businesses
  }


  static async getBusinessForAI() {

    const business = await BusinessModel.find({
      status: "approved"})
      .select("businessName type businessInfo address status")
      .lean()

      return JSON.stringify(business, null, 2);
  }
}
