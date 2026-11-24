import { defineConfig } from "@playwright/test";
import hostedConfig from "./playwright.hosted.config";

export default defineConfig({
  ...hostedConfig,
  testMatch: "adventure.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  use: { ...hostedConfig.use, channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge" },
  outputDir: "test-results/adventure-journey",
  reporter: [["list"]],
});
