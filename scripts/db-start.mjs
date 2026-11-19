import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
const command = process.platform === 'win32' ? 'supabase.cmd' : 'supabase';
const run = (args, capture = false) => spawnSync(command, args, { shell: process.platform === 'win32', encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', windowsHide: true });
const docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8', windowsHide: true });
if (docker.error || docker.status !== 0) {
  console.error('Docker Engine no está disponible. Instala y abre Docker Desktop (WSL2 en Windows), luego ejecuta pnpm db:start. No se modificaron datos.');
  process.exit(1);
}
const result = run(['start']);
if (result.status !== 0) process.exit(result.status ?? 1);
const status = run(['status', '-o', 'json'], true);
if (status.status !== 0) { console.error('Supabase arrancó, pero no se pudo leer su configuración. Consulta pnpm exec supabase status.'); process.exit(1); }
const json = JSON.parse(status.stdout);
if (!existsSync('.env.local')) {
  const anon = json.ANON_KEY ?? json.anon_key;
  const service = json.SERVICE_ROLE_KEY ?? json.service_role_key;
  if (!anon || !service) throw new Error('El CLI no devolvió las claves locales. Copia .env.example y usa pnpm exec supabase status.');
  writeFileSync('.env.local', `APP_URL=http://127.0.0.1:3000\nNEXT_PUBLIC_SUPABASE_URL=${json.API_URL ?? 'http://127.0.0.1:54321'}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\nDATABASE_URL=${json.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'}\nDEMO_PASSWORD=EnglishAction!2026\nE2E_BASE_URL=http://127.0.0.1:3000\nMAILBOX_URL=http://127.0.0.1:54324\n`, { mode: 0o600 });
  console.log('.env.local creado con credenciales locales. No lo compartas ni lo añadas a Git.');
} else console.log('.env.local ya existe; se conservó.');
console.log('Base lista. Ejecuta pnpm demo:seed y pnpm dev. Correo local: http://127.0.0.1:54324');
