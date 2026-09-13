import { Response } from "express";
import { AuthRequest } from "../types/request.type";
import { BusinessService } from "../services/business.service";
import { uploadToCloudinary } from "../utils/cloudinaryUpload";
import { businessInterfaceInput } from "../types/business.type";
import { isObjectId, isName, isNonEmptyString, withinLength, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from "../utils/validation";

export class BusinessController {

  static create = async (request: AuthRequest, response: Response) => {
    try {
      const businessData: businessInterfaceInput = request.body;

      if (!isObjectId(businessData.resident)) {
        response.status(400).send("A valid resident is required");
        return;
      }
      if (!isName(businessData.businessName) || !withinLength(businessData.businessName, 120)) {
        response.status(400).send("A valid business name is required");
        return;
      }
      if (!isNonEmptyString(businessData.type)) {
        response.status(400).send("Business type is required");
        return;
      }
      if (!isNonEmptyString(businessData.address)) {
        response.status(400).send("Business address is required");
        return;
      }

      const files = request.files as { [fieldname: string]: { path: string }[] } | undefined;

      // Upload logo
      if (files?.['logo']?.[0]) {
        businessData.logo = await uploadToCloudinary(files['logo'][0].path);
      }

      // Upload document
      if (files?.['document']?.[0]) {
        businessData.document = await uploadToCloudinary(files['document'][0].path);
      }

      // Upload images
      businessData.images = [];
      if (files?.['images']) {
        for (const file of files['images']) {
          const url = await uploadToCloudinary(file.path);
          businessData.images.push(url);
        }
      }

      businessData.status = "pending";

      const business = await BusinessService.create(businessData);
      response.send(business);
    } catch (error) {
      console.error(error);
      response.status(500).send("Failed to create business");
    }
  }

  static getAll = async (request: AuthRequest, response: Response) => {
    try {
      const { status } = request.query;
      const filter = status ? { status } : {};
      const businesses = await BusinessService.getAll(filter);
      response.send(businesses);
    } catch (error) {
      response.status(500).send("Failed to fetch businesses");
    }
  }

  static get = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid business id");
        return;
      }
      const business = await BusinessService.get(id);
      if (!business) {
        response.status(404).send("Business not found");
        return;
      }
      response.send(business);
    } catch (error) {
      response.status(500).send("Failed to fetch business");
    }
  }

  static getByResident = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid resident id");
        return;
      }
      const businesses = await BusinessService.getByResident(id);
      response.send(businesses);
    } catch (error) {
      response.status(500).send("Failed to fetch businesses by resident");
    }
  }

  static update = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const updateData: Record<string, any> = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid business id");
        return;
      }

      const files = request.files as { [fieldname: string]: { path: string }[] } | undefined;

      // Upload new logo if provided
      if (files?.['logo']?.[0]) {
        updateData.logo = await uploadToCloudinary(files['logo'][0].path);
      }

      // Upload new document if provided
      if (files?.['document']?.[0]) {
        updateData.document = await uploadToCloudinary(files['document'][0].path);
      }

      const business = await BusinessService.update(id, updateData);
      if (!business) {
        response.status(404).send("Business not found");
        return;
      }
      response.send(business);
    } catch (error) {
      response.status(500).send("Failed to update business");
    }
  }

  static delete = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      if (!isObjectId(id)) {
        response.status(400).send("Invalid business id");
        return;
      }
      const business = await BusinessService.delete(id);
      if (!business) {
        response.status(404).send("Business not found");
        return;
      }
      response.send({ message: "Business deleted successfully" });
    } catch (error) {
      response.status(500).send("Failed to delete business");
    }
  }

  static updateStatus = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid business id");
        return;
      }
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        response.status(400).send("Invalid status");
        return;
      }

      const business = await BusinessService.updateStatus(id, status);
      if (!business) {
        response.status(404).send("Business not found");
        return;
      }
      response.send({ message: `Business ${status} successfully` });
    } catch (error) {
      response.status(500).send("Failed to update business status");
    }
  }

  static addImages = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const files = request.files as { [fieldname: string]: { path: string }[] } | undefined;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid business id");
        return;
      }
      if (!files?.['images'] || files['images'].length === 0) {
        response.status(400).send("No images provided");
        return;
      }

      const business = await BusinessService.get(id);
      if (!business) {
        response.status(404).send("Business not found");
        return;
      }

      // Upload new images
      const newImages: string[] = [];
      for (const file of files['images']) {
        const url = await uploadToCloudinary(file.path);
        newImages.push(url);
      }

      // Append to existing images
      const updatedImages = [...(business.images || []), ...newImages];
      const updated = await BusinessService.update(id, { images: updatedImages });

      response.send(updated);
    } catch (error) {
      response.status(500).send("Failed to add images");
    }
  }

  static removeImage = async (request: AuthRequest, response: Response) => {
    try {
      const { id } = request.params;
      const { imageUrl } = request.body;

      if (!isObjectId(id)) {
        response.status(400).send("Invalid business id");
        return;
      }
      if (!isNonEmptyString(imageUrl)) {
        response.status(400).send("Image URL is required");
        return;
      }

      const business = await BusinessService.get(id);
      if (!business) {
        response.status(404).send("Business not found");
        return;
      }

      const updatedImages = (business.images || []).filter((img: string) => img !== imageUrl);
      const updated = await BusinessService.update(id, { images: updatedImages });

      response.send(updated);
    } catch (error) {
      response.status(500).send("Failed to remove image");
    }
  }
}
