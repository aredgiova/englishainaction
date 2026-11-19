import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from '@playwright/test';

const environmentFile = '.env.hosted-test.local';
if (!existsSync(environmentFile)) throw new Error('Aceptación alojada no ejecutada: falta .env.hosted-test.local con las cuentas ficticias autorizadas.');
loadEnvFile(environmentFile);
for (const name of ['APP_URL', 'E2E_BASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'EIA_HOSTED_TEST_PASSWORD', 'EIA_HOSTED_ADMIN_EMAIL', 'EIA_HOSTED_TEACHER_EMAIL', 'EIA_HOSTED_STUDENT_EMAIL', 'EIA_HOSTED_OUTSIDER_EMAIL']) {
  if (!process.env[name]) throw new Error(`Aceptación alojada no ejecutada: falta ${name}.`);
}
const baseURL = 'http://127.0.0.1:3002';
if (process.env.APP_URL !== baseURL || process.env.E2E_BASE_URL !== baseURL) {
  throw new Error('La suite alojada solo admite APP_URL y E2E_BASE_URL http://127.0.0.1:3002.');
}
if (process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') !== 'https://gpixjzkfovepghpdiikp.supabase.co') {
  throw new Error('La suite alojada solo admite el proyecto de pruebas gpixjzkfovepghpdiikp.');
}
const emails = ['ADMIN', 'TEACHER', 'STUDENT', 'OUTSIDER'].map(role => process.env[`EIA_HOSTED_${role}_EMAIL`]!);
if (emails.some(email => !/^[a-z0-9][a-z0-9._+-]*@example\.invalid$/i.test(email)) || new Set(emails.map(email => email.toLowerCase())).size !== 4) {
  throw new Error('La suite alojada exige cuatro cuentas ficticias distintas del dominio example.invalid.');
}
if (process.env.EIA_HOSTED_TEST_PASSWORD!.length < 12) throw new Error('La contraseña ficticia alojada debe tener al menos 12 caracteres.');

export default defineConfig({
  testDir: './tests/e2e', testMatch: 'hosted.spec.ts',
  fullyParallel: false, workers: 1, retries: 0, timeout: 300_000,
  expect: { timeout: 20_000 },
  outputDir: 'test-results/hosted',
  use: {
    baseURL, headless: true, channel: process.env.PLAYWRIGHT_CHANNEL,
    viewport: { width: 1440, height: 1000 },
    actionTimeout: 15_000, navigationTimeout: 30_000,
    screenshot: 'off', trace: 'off', video: 'off',
  },
  // One case creates one course. Mobile uses a new context inside that same case.
  // The coordinator must start the configured application before running this suite.
  reporter: [['list']],
});
