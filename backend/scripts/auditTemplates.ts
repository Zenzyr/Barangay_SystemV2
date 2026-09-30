import "dotenv/config";
import mongoose from "mongoose";
import DocTemplate from "../model/docTemplate.model";

async function collectInventory() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No URI");
    await mongoose.connect(uri);

    const templates = await DocTemplate.find({}).lean();
    
    const inventory = templates.map((t: any) => ({
        _id: t._id,
        documentType: t.documentType,
        name: t.name,
        sourceType: t.sourceType,
        originalFilename: t.originalFilename,
        originalExists: !!t.originalDocx,
        sha256: t.originalDocx?.sha256 || "N/A",
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
    }));

    console.log(JSON.stringify(inventory, null, 2));
    await mongoose.disconnect();
}

collectInventory().catch(console.error);
