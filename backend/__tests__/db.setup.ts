import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let server: MongoMemoryServer | null = null;

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri();
  }
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "bims-test" });
}, 180000);

afterEach(async () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return;
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    if (c.collectionName === "system.views") continue;
    await c.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await server?.stop();
  server = null;
});