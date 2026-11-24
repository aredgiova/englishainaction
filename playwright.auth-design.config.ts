import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "auth-design.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    screenshot: "only-on-failure",
  },
  webServer: { command: "pnpm dev", url: "http://127.0.0.1:3000/ingresar", reuseExistingServer: true, timeout: 90000 },
  reporter: [["list"]],
});
