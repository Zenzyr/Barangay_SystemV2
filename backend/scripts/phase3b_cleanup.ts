import "dotenv/config";
import mongoose from "mongoose";
import DocTemplate from "../model/docTemplate.model";

async function verifyAndCleanup() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("No MONGODB_URI");
    await mongoose.connect(uri);

    const idsToDelete = ["6ab11dbfd0971726f3d34659", "6ab120b10b99372746307db7"];
    
    // Final verification before deletion
    const db = mongoose.connection.db!; // Non-null assertion safely
    
    for (const id of idsToDelete) {
        const refCount = await db.collection("documentrequests").countDocuments({ 
            template: new mongoose.Types.ObjectId(id)
        });
        console.log(`Verifying ID ${id}: Found ${refCount} references.`);
        if (refCount > 0) throw new Error(`Aborting: ID ${id} has references.`);
    }

    // Perform deletion
    const result = await DocTemplate.deleteMany({ _id: { $in: idsToDelete.map(id => new mongoose.Types.ObjectId(id)) } });
    console.log(`Deleted ${result.deletedCount} records.`);

    // Final verification
    const remaining = await DocTemplate.find({}).lean();
    console.log("Remaining templates:", remaining.length);
    const authoritative = remaining.find((t: any) => t.documentType === "certificateOfIndigency");
    console.log("Authoritative record exists:", !!authoritative, "ID:", authoritative?._id);

    await mongoose.disconnect();
}

verifyAndCleanup().catch(console.error);
