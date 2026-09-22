import "dotenv/config";
import mongoose from "mongoose";
import { DocxTemplateController } from "../controller/docxTemplate.controller";

// Ensure all models are registered
import "../model/account.model";
import "../model/documentRequest.model";
import "../model/docTemplate.model";

async function simulateRender() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const requestId = "6ab27128f98f958bb3174a56";
    
    // Mock Request/Response
    const request = {
        body: { requestId },
        account: { role: "resident", _id: "6ab14c686d265f697aac2075" } // Matching resident ID
    } as any;
    
    const response = {
        status: (code: number) => ({
            send: (msg: string) => { console.error("Error:", code, msg); process.exit(1); }
        }),
        setHeader: (key: string, val: string) => { console.log(`Header: ${key} = ${val}`); },
        send: (buffer: any) => { 
            const fs = require("fs");
            fs.writeFileSync("generated-barangay-certification.docx", buffer);
            console.log("Saved to generated-barangay-certification.docx");
            process.exit(0);
        }
    } as any;

    try {
        await DocxTemplateController.renderByType(request, response);
    } catch (e) {
        console.error("Caught error:", e);
    }
    
    await mongoose.disconnect();
}
simulateRender().catch(console.error);
