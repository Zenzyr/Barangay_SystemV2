import "dotenv/config";
import mongoose from "mongoose";

async function findRequest() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const request = await mongoose.connection.db!.collection("documents").findOne({ document: "barangayCertification" });
    if (!request) {
        console.log("No barangayCertification request found.");
    } else {
        console.log("Found request ID:", request._id.toString());
    }
    await mongoose.disconnect();
}
findRequest().catch(console.error);
