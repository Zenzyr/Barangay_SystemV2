import "dotenv/config";
import mongoose from "mongoose";
import "../model/docTemplate.model";

async function checkTemplate() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const template = await mongoose.connection.db!.collection("doctemplates").findOne({ documentType: "barangayCertification" });
    if (!template) {
        console.log("Template not found");
    } else {
        console.log("Template:", template._id, template.sourceType, !!template.originalDocx);
    }
    await mongoose.disconnect();
}
checkTemplate().catch(console.error);
