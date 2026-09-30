import "dotenv/config";
import mongoose from "mongoose";

async function createUniqueIndex() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const db = mongoose.connection.db!;
    const collection = db.collection('doctemplates');
    
    // Create partial index to only enforce uniqueness on non-empty documentTypes
    await collection.createIndex({ "documentType": 1 }, { 
        unique: true, 
        partialFilterExpression: { "documentType": { $type: "string", $gt: "" } } 
    });
    
    console.log('Unique index created on documentType.');
    await mongoose.disconnect();
}

createUniqueIndex().catch(console.error);
