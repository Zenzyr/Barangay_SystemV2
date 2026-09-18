/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  setupFiles: ["<rootDir>/__tests__/env.setup.ts"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/db.setup.ts"],
  testTimeout: 30000,
  maxWorkers: 1,
};
