import cloudinary from './cloudinary';
import fs from 'fs';

export async function uploadToCloudinary(filePath: string): Promise<string> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'barangay_ids',
    });
    // Clean up local file after upload
    fs.unlinkSync(filePath);
    return result.secure_url;
  } catch (error) {
    // Clean up local file even on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    throw error;
  }
}
