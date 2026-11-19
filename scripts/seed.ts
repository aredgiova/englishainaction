import { createClient, type User } from '@supabase/supabase-js';
import { Client } from 'pg';
import { demoDocument } from '../src/lib/demo-content';
import type { Draft, Profile } from '../src/lib/contracts';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const password = process.env.DEMO_PASSWORD;
  const databaseUrl = process.env.DATABASE_URL;
  if (!url || !key || !anon || !password || !databaseUrl || password.length < 12) throw new Error('Configura .env.local; ejecuta pnpm db:start primero.');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname)) throw new Error('La semilla ficticia solo se permite en Supabase local.');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(databaseUrl).hostname)) throw new Error('La base de la semilla debe ser local.');
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const existing: User[] = [];
  for (let page = 1; ; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (result.error) throw result.error;
    existing.push(...result.data.users);
    if (result.data.users.length < 100) break;
  }
  const fixtures = [
    { email: 'admin@englishinaction.test', name: 'Valeria · Administración', role: 'admin' },
    { email: 'docente@englishinaction.test', name: 'Camila · Docente', role: 'teacher' },
    { email: 'estudiante@englishinaction.test', name: 'Lina · Estudiante', role: 'student' },
    { email: 'sinmatricula@englishinaction.test', name: 'Sam · Sin matrícula', role: 'student' }
  ] as const;
  const users: User[] = [];
  for (const fixture of fixtures) {
    let user = existing.find((item) => item.email === fixture.email);
    if (!user) {
      const result = await admin.auth.admin.createUser({ email: fixture.email, password, email_confirm: true, user_metadata: { name: fixture.name } });
      if (result.error || !result.data.user) throw result.error ?? new Error('No se creó la cuenta.');
      user = result.data.user;
    }
    const result = await admin.from('profiles').upsert({ id: user.id, email: fixture.email, name: fixture.name, role: fixture.role, active: true });
    if (result.error) throw result.error;
    users.push(user);
  }
  async function asActor(email: string) {
    const client = createClient(url!, anon!, { auth: { autoRefreshToken: false, persistSession: false } });
    const result = await client.auth.signInWithPassword({ email, password: password! });
    if (result.error) throw result.error;
    return client;
  }
  const teacher = await asActor(fixtures[1].email);
  async function call<T>(client: typeof teacher, name: string, args = {}): Promise<T> {
    const result = await client.rpc(name, args); if (result.error) throw result.error; return result.data as T;
  }
  // Creation and its durable seed marker commit together. An interrupted seed
  // cannot leave an unmarked extra course; the lock also serializes reruns.
  const database = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  await database.connect();
  let courseId: string;
  try {
    await database.query('begin');
    await database.query("select pg_advisory_xact_lock(hashtext('english-in-action:demo-course'))");
    const registry = await database.query<{ course_id: string }>("select course_id from private.seed_registry where seed_key='phase1-demo'");
    if (registry.rows[0]) courseId = registry.rows[0].course_id;
    else {
      await database.query('set local role authenticated');
      await database.query("select set_config('request.jwt.claim.sub',$1,true)", [users[1].id]);
      const created = await database.query<{ data: { courseId: string } }>('select public.api_create_course($1) data', [{ ...demoDocument, units: [] }]);
      courseId = created.rows[0].data.courseId;
      await database.query('reset role');
      await database.query('insert into private.seed_registry(seed_key,course_id) values($1,$2)', ['phase1-demo', courseId]);
    }
    await database.query('commit');
  } catch (error) { await database.query('rollback'); throw error; }
  finally { await database.end(); }
  const status = await admin.from('courses').select('current_release_id').eq('id', courseId).single();
  if (status.error) throw status.error;
  if (!status.data.current_release_id) {
    const draft = await call<Draft>(teacher, 'api_get_draft', { p_course_id: courseId });
    let revision = draft.revision;
    if (!draft.document.units.length) {
      const saved = await call<{ revision: number }>(teacher, 'api_save_draft', { p_course_id: courseId, p_expected_revision: revision, p_document: demoDocument });
      revision = saved.revision;
    }
    await call(teacher, 'api_publish', { p_course_id: courseId, p_expected_revision: revision });
  }
  const operator = await asActor(fixtures[0].email);
  await call(operator, 'api_enroll', { p_course_id: courseId, p_student_email: fixtures[2].email });
  const me = await call<Profile>(teacher, 'api_me');
  console.log(`Demostración lista. Curso: ${courseId}. Autora: ${me.name}.`);
  console.log(fixtures.map(({ email, role }) => `${role}: ${email}`).join('\n'));
  console.log('Contraseña inicial: valor de DEMO_PASSWORD. La semilla no añade una matrícula a Sam; conserva las matrículas, intentos y publicaciones existentes.');
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
