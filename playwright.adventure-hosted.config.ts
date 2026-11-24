import { defineConfig } from '@playwright/test';
import hostedConfig from './playwright.hosted.config';

// Inherit the exact project, origin and fictional-account guards. Start the
// configured application separately; this suite never starts another server.
export default defineConfig({
  ...hostedConfig,
  testMatch: 'adventure-hosted.spec.ts',
  outputDir: 'test-results/adventure-hosted',
});
