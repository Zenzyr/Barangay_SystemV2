import "dotenv/config";
import mongoose from "mongoose";
import { patchDocument } from "docx";
import DocTemplate from "../model/docTemplate.model";

async function testIntegrity() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const docWithBinary = await DocTemplate.findOne({ documentType: "barangayCertification" }).select("+originalDocx.data").exec();
    if (!docWithBinary || !docWithBinary.originalDocx || !docWithBinary.originalDocx.data) {
        throw new Error("Missing binary");
    }

    const originalBuffer = docWithBinary.originalDocx.data;
    console.log("Original Size:", originalBuffer.length);

    try {
        const patched = await patchDocument({
            outputType: "nodebuffer" as any,
            data: originalBuffer,
            patches: {},
        });
        console.log("Patched size (empty patches):", Buffer.from(patched as any).length);
    } catch (e) {
        console.error("Patching failed:", e);
    }

    await mongoose.disconnect();
}
testIntegrity().catch(console.error);
