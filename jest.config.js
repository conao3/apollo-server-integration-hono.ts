export default {
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/integration/**/*.test.ts"],
  transform: { "^.+\\.ts$": "@swc/jest" },
}
