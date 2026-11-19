import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from '@playwright/test';

if (!existsSync('.env.local')) {
  throw new Error('E2E journey no ejecutado: falta .env.local. Inicia Docker, ejecuta pnpm db:start y pnpm demo:seed. Esta suite requiere Supabase real; no usa mocks ni omite pruebas.');
}
loadEnvFile('.env.local');
for (const name of ['APP_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'DEMO_PASSWORD', 'MAILBOX_URL']) {
  if (!process.env[name]) throw new Error(`E2E journey no ejecutado: falta ${name} en .env.local.`);
}
const baseURL = process.env.E2E_BASE_URL ?? process.env.APP_URL!;
const port = new URL(baseURL).port || (new URL(baseURL).protocol === 'https:' ? '443' : '80');
for (const [name, value] of Object.entries({ E2E_BASE_URL: baseURL, APP_URL: process.env.APP_URL!, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!, DATABASE_URL: process.env.DATABASE_URL!, MAILBOX_URL: process.env.MAILBOX_URL! })) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) {
    throw new Error(`${name} debe ser local: journey crea cursos, cuentas e intentos ficticios.`);
  }
}
if (new URL(baseURL).origin !== new URL(process.env.APP_URL!).origin) {
  throw new Error('E2E_BASE_URL y APP_URL deben compartir origen para las cookies y las escrituras.');
}

export default defineConfig({
  testDir: './tests/e2e', testMatch: 'journey.spec.ts',
  fullyParallel: false, workers: 1, retries: 0, timeout: 300_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/journey',
  use: { baseURL, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  // Run against a production build; a server already started by the verifier is reused.
  webServer: { command: `pnpm start --port ${port}`, url: `${baseURL}/ingresar`, reuseExistingServer: true, timeout: 90_000, env: { APP_URL: baseURL } },
  reporter: [['list']],
});
