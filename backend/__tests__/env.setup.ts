// Test environment defaults — loaded before any test module.
process.env.NODE_ENV = "test";
process.env.TZ = "Asia/Manila";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-that-is-at-least-32-characters-long!";
process.env.AI_PROVIDER = process.env.AI_PROVIDER || "rule-based";
process.env.MONGODB_URI = process.env.MONGODB_URI || "";