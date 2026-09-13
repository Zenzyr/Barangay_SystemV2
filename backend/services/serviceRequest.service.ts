import ServiceRequestModel from "../model/serviceRequest.model";
import { serviceRequestInterfaceInput, ServiceRequestStatus } from "../types/serviceRequest.type";

export class ServiceRequestService {

  static async create(data: serviceRequestInterfaceInput) {
    return await ServiceRequestModel.create(data);
  }

  static async get(id: string) {
    return await ServiceRequestModel.findById(id)
      .populate("client", "-password")
      .populate("provider", "-password");
  }

  static async getByClient(clientId: string) {
    return await ServiceRequestModel.find({ client: clientId })
      .populate("provider", "-password")
      .sort({ createdAt: -1 });
  }

  static async getByProvider(providerId: string) {
    return await ServiceRequestModel.find({ provider: providerId })
      .populate("client", "-password")
      .sort({ createdAt: -1 });
  }

  static async updateStatus(id: string, status: ServiceRequestStatus) {
    return await ServiceRequestModel.findByIdAndUpdate(id, { status }, { new: true });
  }
}
