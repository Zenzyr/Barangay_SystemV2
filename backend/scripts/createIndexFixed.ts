import "dotenv/config";
import mongoose from "mongoose";

async function fixIndex() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const db = mongoose.connection.db!;
    const collection = db.collection('doctemplates');
    
    // Drop existing bad index
    await collection.dropIndex('documentType_unique_partial').catch(() => console.log('Index not found, skipping drop.'));
    
    // Create correct partial index
    await collection.createIndex({ "documentType": 1 }, { 
        unique: true, 
        name: 'documentType_unique_partial',
        // The issue likely was escaped/quoted $ in shell, this script is safe
        partialFilterExpression: { "documentType": { "$type": "string", "$gt": "" } } 
    });
    
    console.log('Unique partial index created/fixed on documentType.');
    await mongoose.disconnect();
}

fixIndex().catch(console.error);
