import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { demoDocument } from '../src/lib/demo-content';
import type { AttemptResult, CourseSummary, Lesson, Outline, Profile } from '../src/lib/contracts';

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}. Ejecuta pnpm db:start, pnpm demo:seed y pnpm dev antes de pnpm verify:local.`);
  return value;
}
function local(name: string, value: string) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) throw new Error(`${name} debe apuntar a localhost; esta prueba crea datos ficticios.`);
  return value.replace(/\/$/, '');
}
type Envelope<T> = { data: T; error?: { code: string; message: string } };
class BrowserSession {
  private cookies = new Map<string, string>();
  constructor(private app: string) {}
  async request(path: string, method = 'GET', body?: unknown, extra: Record<string, string> = {}) {
    const response = await fetch(new URL(path, this.app), {
      method, redirect: 'manual', signal: AbortSignal.timeout(30_000),
      headers: { Origin: this.app, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]; const split = pair.indexOf('=');
      const key = pair.slice(0, split); const value = pair.slice(split + 1);
      if (!value || /max-age=0/i.test(cookie)) this.cookies.delete(key); else this.cookies.set(key, value);
    }
    return response;
  }
  async api<T>(path: string, expected: number, method = 'GET', body?: unknown, extra?: Record<string, string>) {
    const response = await this.request(`/api/v1${path}`, method, body, extra);
    const payload = await response.json() as Envelope<T>;
    assert.equal(response.status, expected, `${method} ${path}: esperado ${expected}, recibido ${response.status}; ${payload.error?.code ?? ''}`);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    return payload.data;
  }
}

async function main() {
  const app = local('APP_URL', required('APP_URL'));
  const supabaseUrl = local('NEXT_PUBLIC_SUPABASE_URL', required('NEXT_PUBLIC_SUPABASE_URL'));
  const databaseUrl = local('DATABASE_URL', required('DATABASE_URL'));
  const mailbox = local('MAILBOX_URL', required('MAILBOX_URL'));
  const anon = required('NEXT_PUBLIC_SUPABASE_ANON_KEY'); const password = required('DEMO_PASSWORD');
  const clients: Client[] = [];
  async function connection() { const client = new Client({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 }); await client.connect(); clients.push(client); return client; }
  const postgres = await connection();
  try {
    const teacher = new BrowserSession(app), admin = new BrowserSession(app), student = new BrowserSession(app), outsider = new BrowserSession(app);
    await new BrowserSession(app).api('/me', 401);
    const login = (session: BrowserSession, email: string, pass = password) => session.api<Profile>('/auth/login', 200, 'POST', { email, password: pass });
    await login(teacher, 'docente@englishinaction.test'); await login(admin, 'admin@englishinaction.test');
    const learner = await login(student, 'estudiante@englishinaction.test'); await login(outsider, 'sinmatricula@englishinaction.test');
    const document = structuredClone(demoDocument); document.title = `First Conversations · verificación ${Date.now()}`;
    const created = await teacher.api<{ courseId: string; revision: number }>('/courses', 201, 'POST', { title: document.title, level: document.level, audience: document.audience });
    const base = `/courses/${created.courseId}`;
    const saved = await teacher.api<{ revision: number }>(`${base}/draft`, 200, 'PUT', { expectedRevision: created.revision, document });
    const released = await teacher.api<{ releaseId: string }>(`${base}/releases`, 201, 'POST', { expectedRevision: saved.revision });
    assert.deepEqual(await teacher.api(`${base}/releases`, 200, 'POST', { expectedRevision: saved.revision }), released);
    const enrollment = { studentEmail: learner.email };
    const firstEnrollment = await admin.api(`${base}/enrollments`, 201, 'POST', enrollment);
    assert.deepEqual(await admin.api(`${base}/enrollments`, 200, 'POST', enrollment), firstEnrollment);
    const lesson = await student.api<Lesson>(`${base}/lessons/intro`, 200);
    assert.ok(!JSON.stringify(lesson).includes('correctOptionId')); assert.ok(!JSON.stringify(lesson).includes('feedback'));
    const body = { lessonVersionId: lesson.lessonVersionId, answers: [{ activityId: 'origin', optionId: 'yopal' }] };
    const retryKey = randomUUID(); const endpoint = `${base}/lessons/intro/attempts`;
    const first = await student.api<AttemptResult>(endpoint, 201, 'POST', body, { 'Idempotency-Key': retryKey });
    assert.deepEqual(first.score, { correct: 1, total: 1 });
    assert.deepEqual(first.courseProgress, { completed: 1, total: 2, nextLessonId: 'classmate' });
    assert.deepEqual(await student.api(endpoint, 200, 'POST', body, { 'Idempotency-Key': retryKey }), first);
    const count = await postgres.query<{ count: string }>('select count(*) from public.attempts where course_id=$1 and student_id=$2 and idempotency_key=$3', [created.courseId, learner.id, retryKey]);
    assert.equal(count.rows[0].count, '1');
    await student.api('/auth/logout', 200, 'POST'); await login(student, learner.email);
    assert.deepEqual((await student.api<Outline>(`${base}/outline`, 200)).courseProgress, first.courseProgress);
    await outsider.api(`${base}/lessons/intro`, 404);
    console.log('✓ HTTP por roles, publicación, matrícula, reenvío único, sesión nueva y avance 1/2.');

    const direct = createClient(supabaseUrl, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await direct.auth.signInWithPassword({ email: learner.email, password })).error, null);
    const versions = await direct.from('lesson_versions').select('*').eq('course_id', created.courseId);
    assert.equal(versions.error, null); assert.equal(versions.data?.length, 2);
    assert.ok(!JSON.stringify(versions.data).includes('correctOptionId')); assert.ok(!JSON.stringify(versions.data).includes('content_hash'));
    const draftRows = await direct.from('drafts').select('*').eq('course_id', created.courseId);
    assert.equal(draftRows.error, null); assert.equal(draftRows.data?.length, 0);
    assert.ok((await direct.schema('private').from('answer_keys').select('*')).error);
    assert.ok((await direct.from('profiles').update({ role: 'admin' }).eq('id', learner.id)).error);
    await direct.auth.signOut();
    console.log('✓ PostgREST directo aplica RLS y no expone claves privadas ni permite elevar el rol.');

    // Separate PostgreSQL connections, both authenticated as the same student.
    const pair = await Promise.all([connection(), connection()]); const concurrentKey = randomUUID();
    await Promise.all(pair.map(async connection => {
      await connection.query('begin'); await connection.query('set local role authenticated');
      await connection.query("select set_config('request.jwt.claim.sub',$1,true)", [learner.id]);
    }));
    const race = await Promise.all(pair.map(async connection => {
      try {
        const result = await connection.query<{ result: { created: boolean; data: AttemptResult } }>('select public.api_attempt($1,$2,$3,$4) result', [created.courseId, 'intro', concurrentKey, body]);
        await connection.query('commit'); return result.rows[0].result;
      } catch (error) { await connection.query('rollback'); throw error; }
    }));
    assert.equal(race.filter(result => result.created).length, 1); assert.deepEqual(race[0].data, race[1].data);
    const raceCount = await postgres.query<{ count: string }>('select count(*) from public.attempts where course_id=$1 and idempotency_key=$2', [created.courseId, concurrentKey]);
    assert.equal(raceCount.rows[0].count, '1');
    const httpKey = randomUUID();
    const httpRace = await Promise.all([student.request(`/api/v1${endpoint}`, 'POST', body, { 'Idempotency-Key': httpKey }), student.request(`/api/v1${endpoint}`, 'POST', body, { 'Idempotency-Key': httpKey })]);
    assert.deepEqual(httpRace.map(response => response.status).sort(), [200, 201]);
    assert.deepEqual(await httpRace[0].json(), await httpRace[1].json());
    console.log('✓ Concurrencia real: dos conexiones PostgreSQL y dos peticiones HTTP conservan un intento por clave.');

    const publishedTitle = document.title;
    document.title += ' · unpublished'; document.level = 'B2'; document.audience = 'professional';
    document.units[0].lessons[0].objective += ' Speak clearly to a new classmate.';
    const updated = await teacher.api<{ revision: number }>(`${base}/draft`, 200, 'PUT', { expectedRevision: saved.revision, document });
    assert.equal((await student.api<Lesson>(`${base}/lessons/intro`, 200)).lessonVersionId, lesson.lessonVersionId);
    const studentCourses = await student.api<CourseSummary[]>('/courses', 200);
    const visibleCourse = studentCourses.find(course => course.courseId === created.courseId);
    assert.equal(visibleCourse?.title, publishedTitle); assert.equal(visibleCourse?.revision, saved.revision);
    assert.equal(visibleCourse?.level, demoDocument.level); assert.equal(visibleCourse?.audience, demoDocument.audience);
    assert.equal((await direct.auth.signInWithPassword({ email: learner.email, password })).error, null);
    const mutableRows = await direct.from('courses').select('*').eq('id', created.courseId);
    assert.equal(mutableRows.error, null); assert.deepEqual(mutableRows.data, []);
    const publishedRows = await direct.from('releases').select('id,title').eq('id', released.releaseId);
    assert.equal(publishedRows.error, null); assert.deepEqual(publishedRows.data, [{ id: released.releaseId, title: publishedTitle }]);
    await direct.auth.signOut();
    await teacher.api(`${base}/releases`, 201, 'POST', { expectedRevision: updated.revision });
    assert.notEqual((await student.api<Lesson>(`${base}/lessons/intro`, 200)).lessonVersionId, lesson.lessonVersionId);
    assert.equal((await student.api<Outline>(`${base}/outline`, 200)).courseProgress.completed, 0);
    await student.api(endpoint, 409, 'POST', body, { 'Idempotency-Key': randomUUID() });
    assert.deepEqual(await student.api(endpoint, 200, 'POST', body, { 'Idempotency-Key': retryKey }), first);
    console.log('✓ El borrador queda aislado; una nueva publicación conserva intentos y reenvíos históricos.');

    // Mailpit documents /view/latest.html with query filters for integration tests.
    async function mailLink(email: string, type: 'invite' | 'recovery') {
      const subject = type === 'invite' ? 'invitación' : 'Recupera';
      const url = `${mailbox}/view/latest.html?query=${encodeURIComponent(`to:${email} subject:${subject}`)}`;
      for (let n = 0; n < 20; n++) {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (response.ok) {
          const html = await response.text();
          for (const match of html.matchAll(/href=["']([^"']+)["']/g)) {
            const candidate = new URL(match[1].replaceAll('&amp;', '&'), app);
            if (candidate.origin === app && candidate.pathname === '/auth/confirm' && candidate.searchParams.get('type') === type) return candidate.toString();
          }
        }
        await delay(1000);
      }
      throw new Error('No se encontró el correo esperado en Mailpit. Consulta docs/local-verification.md; el correo no se considera verificado.');
    }
    const invitedEmail = `verificacion-${randomUUID()}@englishinaction.test`;
    await admin.api('/admin/invitations', 201, 'POST', { email: invitedEmail, name: 'Docente de verificación local', role: 'teacher' });
    await admin.api('/admin/invitations', 409, 'POST', { email: invitedEmail, name: 'Duplicado', role: 'teacher' });
    const invited = new BrowserSession(app); const inviteLink = await mailLink(invitedEmail, 'invite');
    const confirm = await invited.request(inviteLink);
    assert.equal(confirm.status, 303); assert.equal(new URL(confirm.headers.get('location')!, app).pathname, '/definir-clave');
    const invitedPassword = `Local!${randomUUID()}`;
    await invited.api('/auth/password', 200, 'POST', { password: invitedPassword });
    assert.equal((await invited.api<Profile>('/me', 200)).role, 'teacher');
    await invited.api('/auth/logout', 200, 'POST');
    await delay(1100); // Auth's configured per-address email rate limit is one second.
    await invited.api('/auth/recover', 200, 'POST', { email: invitedEmail });
    const recovery = await invited.request(await mailLink(invitedEmail, 'recovery'));
    assert.equal(recovery.status, 303); assert.equal(new URL(recovery.headers.get('location')!, app).pathname, '/definir-clave');
    const recoveredPassword = `Recovered!${randomUUID()}`;
    await invited.api('/auth/password', 200, 'POST', { password: recoveredPassword });
    await invited.api('/auth/logout', 200, 'POST'); assert.equal((await login(invited, invitedEmail, recoveredPassword)).role, 'teacher');
    console.log('✓ Correo real local: invitación, enlace /auth/confirm, definición de clave y recuperación completados.');
    console.log(`Verificación completa. Curso ficticio conservado para inspección: ${created.courseId}`);
  } finally { await Promise.all(clients.map(client => client.end())); }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo completar la verificación local.');
  console.error('No se declara aprobada ninguna comprobación posterior al fallo. Revisa docs/local-verification.md.');
  process.exitCode = 1;
});
