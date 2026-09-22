import "dotenv/config";
import mongoose from "mongoose";
import JSZip from "jszip";
import DocTemplate from "../model/docTemplate.model";
import { replaceVariablesInDocx } from "../services/docTemplateFidelity.service";

async function verifyFidelity() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const template = await DocTemplate.findOne({ documentType: 'barangayCertification' }).exec();
    if (!template) throw new Error("Template not found");
    
    // Explicitly fetch the data
    const docWithBinary = await DocTemplate.findById(template._id).select("+originalDocx.data").exec();
    if (!docWithBinary || !docWithBinary.originalDocx || !docWithBinary.originalDocx.data) {
        throw new Error("Original data missing or not fetched");
    }

    const originalBuffer = docWithBinary.originalDocx.data;
    
    // Patching
    const values = { "applicantName": "John Doe" }; // Example placeholder
    const patchedBuffer = await replaceVariablesInDocx(originalBuffer, values);

    // ZIP Analysis
    const originalZip = await JSZip.loadAsync(originalBuffer);
    const patchedZip = await JSZip.loadAsync(patchedBuffer);

    console.log("--- ZIP File Analysis ---");
    console.log("Original Size:", originalBuffer.length);
    console.log("Patched Size:", patchedBuffer.length);
    
    const orgFiles = Object.keys(originalZip.files).sort();
    const patFiles = Object.keys(patchedZip.files).sort();
    
    console.log("--- ZIP Inventory Comparison ---");
    console.log("Original Files:", orgFiles.length);
    console.log("Patched Files:", patFiles.length);

    console.log("--- Missing/Added Files ---");
    orgFiles.forEach(f => { if (!patchedZip.files[f]) console.log("Missing:", f); });
    patFiles.forEach(f => { if (!originalZip.files[f]) console.log("Added:", f); });

    // Compare content lengths of key files
    const keyFiles = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'];
    for (const f of keyFiles) {
        if (originalZip.files[f] && patchedZip.files[f]) {
            const orgContent = await originalZip.files[f].async("text");
            const patContent = await patchedZip.files[f].async("text");
            console.log(`--- ${f} ---`);
            console.log(`Original length: ${orgContent.length}, Patched length: ${patContent.length}`);
            if (orgContent !== patContent) {
                 console.log("Content differs.");
            }
        } else {
            console.log(`File ${f} not present in one of the ZIPs.`);
        }
    }

    await mongoose.disconnect();
}

verifyFidelity().catch(console.error);
