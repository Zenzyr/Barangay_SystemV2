import "dotenv/config";
import mongoose from "mongoose";

async function listCollections() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const collections = await mongoose.connection.db!.listCollections().toArray();
    console.log("Collections:", collections.map(c => c.name));
    
    // Check if the request collection is named something else
    // Common names: documentrequests, requests, document-requests
    const reqColl = collections.find(c => c.name.includes("request"));
    if (reqColl) {
        console.log("Found likely request collection:", reqColl.name);
        const sample = await mongoose.connection.db!.collection(reqColl.name).findOne({});
        console.log("Sample request:", sample);
    }
    
    await mongoose.disconnect();
}
listCollections().catch(console.error);
