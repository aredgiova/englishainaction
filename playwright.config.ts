import { defineConfig } from '@playwright/test';
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  testMatch: 'access.spec.ts',
  use: { baseURL, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev', url: `${baseURL}/ingresar`, reuseExistingServer: true, timeout: 90000, env: { APP_URL: baseURL } },
  reporter: [['list']]
});
