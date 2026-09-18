import cloudinary from "./cloudinary";
import fs from "fs";

export async function uploadToCloudinary(file: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(file, {
      folder: "barangay_ids",
    });
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return result.secure_url;
  } catch (error) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    throw error;
  }
}
