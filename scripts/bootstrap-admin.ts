import { Client } from 'pg';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { uuidSchema } from '../src/lib/contracts';

export interface BootstrapDatabase {
  query<T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export class BootstrapAdminError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'BootstrapAdminError';
  }
}

/** One-time administrative provisioning; never import this script into an HTTP route. */
export async function bootstrapAdmin(database: BootstrapDatabase, userId: string) {
  if (!uuidSchema.safeParse(userId).success) {
    throw new BootstrapAdminError('invalid_user_id', 'Indica explícitamente un UUID válido de Supabase Auth.');
  }
  await database.query('begin');
  try {
    const privilege = await database.query<{ privileged: boolean }>(
      'select rolsuper or rolbypassrls as privileged from pg_roles where rolname=current_user',
    );
    if (privilege.rows[0]?.privileged !== true) {
      throw new BootstrapAdminError('privileged_connection_required', 'El aprovisionamiento requiere una conexión PostgreSQL administrativa externa a la aplicación.');
    }
    await database.query("select pg_advisory_xact_lock(hashtext('english-in-action:bootstrap-admin'))");
    // Serialize profile changes too, including other administrative provisioning.
    await database.query('lock table public.profiles in share row exclusive mode');
    const existing = await database.query<{ id: string }>("select id from public.profiles where role='admin' limit 1");
    if (existing.rows.length) {
      throw new BootstrapAdminError('admin_already_exists', 'Ya existe una cuenta administradora. Este procedimiento de inicio no puede volver a utilizarse.');
    }
    const identity = await database.query<{ confirmed: boolean }>(
      'select email_confirmed_at is not null as confirmed from auth.users where id=$1 for update', [userId],
    );
    if (!identity.rows.length) throw new BootstrapAdminError('identity_not_found', 'El UUID indicado no existe en Supabase Auth.');
    if (!identity.rows[0].confirmed) throw new BootstrapAdminError('email_unconfirmed', 'Confirma el correo de la identidad en Auth antes de continuar.');
    const profile = await database.query<{ active: boolean }>('select active from public.profiles where id=$1 for update', [userId]);
    if (!profile.rows.length) throw new BootstrapAdminError('profile_not_found', 'La identidad no tiene un perfil de academia. Revisa las migraciones antes de continuar.');
    if (!profile.rows[0].active) throw new BootstrapAdminError('profile_inactive', 'El perfil indicado está inactivo; no se modificó su estado.');
    const promoted = await database.query<{ id: string }>(
      "update public.profiles set role='admin' where id=$1 and active returning id", [userId],
    );
    if (promoted.rows.length !== 1) throw new BootstrapAdminError('profile_not_promoted', 'No se pudo promover el perfil indicado.');
    await database.query('commit');
    return { id: promoted.rows[0].id, role: 'admin' as const };
  } catch (error) {
    await database.query('rollback');
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !uuidSchema.safeParse(args[0]).success) {
    throw new BootstrapAdminError('invalid_arguments', 'Uso: pnpm admin:bootstrap <UUID-confirmado-de-Auth>.');
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new BootstrapAdminError('missing_database_url', 'Configura DATABASE_URL mediante el canal seguro del entorno antes de ejecutar el procedimiento.');
  const database = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  try {
    await database.connect();
    await bootstrapAdmin(database, args[0]);
    console.log('Administrador inicial configurado. Verifica el acceso y el rol en /api/v1/me.');
  } finally {
    await database.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    // Driver errors may contain connection details. Never print credentials or DSNs.
    console.error(error instanceof BootstrapAdminError ? error.message : 'No se completó el aprovisionamiento. Revisa la conexión administrativa y el esquema del entorno seleccionado.');
    process.exitCode = 1;
  });
}
