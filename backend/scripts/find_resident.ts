import "dotenv/config";
import mongoose from "mongoose";
import "../model/documentRequest.model";

async function findRequestResident() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const request = await mongoose.connection.db!.collection("documents").findOne({ _id: new mongoose.Types.ObjectId("6ab27128f98f958bb3174a56") });
    console.log("Resident ID:", request?.resident);
    
    await mongoose.disconnect();
}
findRequestResident().catch(console.error);
