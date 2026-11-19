import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { bootstrapAdmin } from '../scripts/bootstrap-admin';

let db: PGlite;
const targetId = '00000000-0000-4000-8000-000000000101';
const otherId = '00000000-0000-4000-8000-000000000102';
const missingId = '00000000-0000-4000-8000-000000000103';
type ProfileSnapshot = { id: string; name: string; email: string; role: string; active: boolean };
const snapshot = async () => (await db.query<ProfileSnapshot>('select id,name,email,role,active from public.profiles order by id')).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email text not null,raw_user_meta_data jsonb not null default '{}',email_confirmed_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, directory), 'utf8'));
  }
});

beforeEach(async () => {
  await db.exec('reset role; truncate auth.users cascade');
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6)', [
    targetId, 'target@example.test', { name: 'Target', role: 'admin' },
    otherId, 'other@example.test', { name: 'Other', role: 'admin' },
  ]);
});
afterAll(async () => { await db?.close(); });

describe('private bootstrap of the first administrator', () => {
  it('promotes only the explicit confirmed UUID and preserves every other profile field', async () => {
    const before = await snapshot();
    expect(await bootstrapAdmin(db, targetId)).toEqual({ id: targetId, role: 'admin' });
    expect(await snapshot()).toEqual(before.map(row => row.id === targetId ? { ...row, role: 'admin' } : row));
    await expect(bootstrapAdmin(db, targetId)).rejects.toMatchObject({ code: 'admin_already_exists' });
    await expect(bootstrapAdmin(db, otherId)).rejects.toMatchObject({ code: 'admin_already_exists' });
    expect((await db.query("select id from public.profiles where role='admin'")).rows).toEqual([{ id: targetId }]);
  });

  it('refuses to replace an existing inactive administrator', async () => {
    await db.query("update public.profiles set role='admin',active=false where id=$1", [otherId]);
    const before = await snapshot();
    await expect(bootstrapAdmin(db, targetId)).rejects.toMatchObject({ code: 'admin_already_exists' });
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    { code: 'identity_not_found', uuid: missingId, prepare: async () => {} },
    { code: 'email_unconfirmed', uuid: targetId, prepare: async () => { await db.query('update auth.users set email_confirmed_at=null where id=$1', [targetId]); } },
    { code: 'profile_not_found', uuid: targetId, prepare: async () => { await db.query('delete from public.profiles where id=$1', [targetId]); } },
    { code: 'profile_inactive', uuid: targetId, prepare: async () => { await db.query('update public.profiles set active=false where id=$1', [targetId]); } },
  ])('rejects $code without writes and leaves the connection usable', async ({ code, uuid, prepare }) => {
    await prepare();
    const before = await snapshot();
    await expect(bootstrapAdmin(db, uuid)).rejects.toMatchObject({ code });
    expect(await snapshot()).toEqual(before);
    expect(await bootstrapAdmin(db, otherId)).toEqual({ id: otherId, role: 'admin' });
  });

  it('rejects a nonprivileged database role before reading or changing private identities', async () => {
    const before = await snapshot();
    await db.exec('set role authenticated');
    await expect(bootstrapAdmin(db, targetId)).rejects.toMatchObject({ code: 'privileged_connection_required' });
    await db.exec('reset role');
    expect(await snapshot()).toEqual(before);
  });

  it('requires an explicit valid UUID without using metadata as an alternate identity', async () => {
    const before = await snapshot();
    await expect(bootstrapAdmin(db, '')).rejects.toMatchObject({ code: 'invalid_user_id' });
    expect(await snapshot()).toEqual(before);
  });
});
