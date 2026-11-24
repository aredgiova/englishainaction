import { defineConfig } from '@playwright/test';
import hostedConfig from './playwright.hosted.config';

// Reuse the exact hosted project/origin and four fictional-account safeguards.
// The coordinator starts the application and applies the reviewed migration.
export default defineConfig({
  ...hostedConfig,
  testMatch: 'adventure-access.spec.ts',
  outputDir: 'test-results/adventure-access',
});
