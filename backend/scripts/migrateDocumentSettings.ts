import mongoose from "mongoose";
import dotenv from "dotenv";
import BarangaySettingsModel from "../model/barangaySettings.model";

dotenv.config();

const migrate = async () => {
  try {
    // Note: adjust connection string if necessary
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/brgy-rabon");
    console.log("Connected to DB, starting migration...");

    const settings = await BarangaySettingsModel.findOne();
    if (!settings) {
      console.log("No settings found, skipping.");
      return;
    }

    // @ts-ignore
    const oldDocs = settings.documents;
    
    if (oldDocs.templates) {
      console.log("Settings already migrated, skipping.");
      return;
    }

    // Convert old global structure to template config
    const newTemplates: Record<string, any> = {};

    // Use known overlays as keys
    // @ts-ignore
    const overlayKeys: string[] = Object.keys(oldDocs.overlays || {});
    
    for (const type of overlayKeys) {
      newTemplates[type] = {
        // @ts-ignore
        backgroundUrl: oldDocs.backgroundUrl || "",
        // @ts-ignore
        marginLeft: oldDocs.marginLeft || 60,
        // @ts-ignore
        marginRight: oldDocs.marginRight || 60,
        // @ts-ignore
        marginTop: oldDocs.marginTop || 60,
        // @ts-ignore
        marginBottom: oldDocs.marginBottom || 60,
        // @ts-ignore
        overlays: oldDocs.overlays[type] || [],
      };
    }

    // @ts-ignore
    settings.documents = {
      headerText: oldDocs.headerText,
      footerText: oldDocs.footerText,
      logoUrl: oldDocs.logoUrl,
      sealUrl: oldDocs.sealUrl,
      certificateNumberFormat: oldDocs.certificateNumberFormat,
      signatoryTitle: oldDocs.signatoryTitle,
      signaturePositions: oldDocs.signaturePositions,
      templates: newTemplates
    };

    await settings.save();
    console.log("Migration complete.");
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

migrate();
