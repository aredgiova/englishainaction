import { mkdir, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

// Run only after the browser acceptance test finishes and its owner authorizes it.
// pnpm verify:hosted <course-id>
// Tokens, credentials, request bodies, responses and user identifiers stay in memory.
const target = 'https://gpixjzkfovepghpdiikp.supabase.co';
const projectRef = 'gpixjzkfovepghpdiikp';
const roles = ['admin', 'teacher', 'student', 'outsider'];
const env = process.env;
const fixture = Object.fromEntries(roles.map(role => [role, env[`EIA_HOSTED_${role.toUpperCase()}_EMAIL`]]));
const summary = { projectRef, result: 'pending', checks: [] };
class AuditFailure extends Error {}
function check(value, label) {
  if (!value) throw new AuditFailure(label);
  summary.checks.push(label);
}
function noAnswerKeys(value) {
  if (!value || typeof value !== 'object') return true;
  return Object.entries(value).every(([key, child]) => !['correctOptionId', 'feedback', 'content_hash', 'answer_keys'].includes(key) && noAnswerKeys(child));
}
async function request(path, { token, service = false, method = 'GET', body, schema } = {}) {
  const key = service ? env.SUPABASE_SERVICE_ROLE_KEY : env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${token || key}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (schema) headers['Accept-Profile'] = schema;
  let response;
  try {
    response = await fetch(`${target}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new AuditFailure('network_request_failed');
  }
  let data;
  try { data = await response.json(); } catch { throw new AuditFailure('response_not_json'); }
  return { status: response.status, data, ok: response.ok };
}
function tablePath(table, column, value, select = '*', order) {
  const query = new URLSearchParams({ select, [column]: `eq.${value}` });
  if (order) query.set('order', order);
  return `/rest/v1/${table}?${query}`;
}
async function rows(table, column, value, identity, select = '*', order) {
  const result = await request(tablePath(table, column, value, select, order), identity);
  check(result.ok && Array.isArray(result.data), `${identity.service ? 'observer' : 'actor'}_${table}_read_ok`);
  return result.data;
}
async function rpc(name, body, token) {
  return request(`/rest/v1/rpc/${name}`, { method: 'POST', body, token });
}
function deniedDomain(result, status, code, label) {
  let detail;
  try { detail = JSON.parse(result.data?.message); } catch { detail = undefined; }
  check(!result.ok && result.data?.code === 'P0001' && detail?.status === status && detail?.code === code, label);
  return { transportStatus: result.status, domainStatus: detail.status, code: detail.code };
}
async function main() {
  const suppliedCourse = process.argv[2];
  check(typeof suppliedCourse === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(suppliedCourse), 'course_argument_valid');
  check(env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') === target, 'authorized_project');
  check(env.APP_URL === 'http://127.0.0.1:3002' && env.E2E_BASE_URL === env.APP_URL, 'authorized_app_origin');
  check(typeof env.NEXT_PUBLIC_SUPABASE_ANON_KEY === 'string' && env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 20 && typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' && env.SUPABASE_SERVICE_ROLE_KEY.length > 20, 'credentials_configured');
  check(Object.values(fixture).every(email => typeof email === 'string' && /^[a-z0-9][a-z0-9._+-]*@example\.invalid$/i.test(email)) && new Set(Object.values(fixture).map(email => email.toLowerCase())).size === 4, 'four_fictional_identities');
  check(typeof env.EIA_HOSTED_TEST_PASSWORD === 'string' && env.EIA_HOSTED_TEST_PASSWORD.length >= 12, 'fixture_password_configured');

  const sessions = {};
  for (const role of roles) {
    const auth = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: fixture[role], password: env.EIA_HOSTED_TEST_PASSWORD } });
    check(auth.status === 200 && typeof auth.data?.access_token === 'string' && typeof auth.data?.user?.id === 'string', `${role}_real_auth_login`);
    sessions[role] = { token: auth.data.access_token, id: auth.data.user.id };
    const me = await rpc('api_me', {}, sessions[role].token);
    check(me.ok && me.data?.id === sessions[role].id && me.data?.role === (role === 'outsider' ? 'student' : role), `${role}_profile_authorization`);
  }
  summary.realAuthLogins = roles.length;
  const observer = { service: true };
  const found = await rows('courses', 'id', suppliedCourse, observer);
  check(found.length === 1, 'one_requested_course');
  const [course] = found;
  check(course.owner_id === sessions.teacher.id && course.title.startsWith('First Conversations · QA alojada ') && typeof course.current_release_id === 'string', 'acceptance_course_owned_published');
  const courseId = course.id;
  const scope = [
    ['courses', 'id', courseId], ['drafts', 'course_id', courseId],
    ['releases', 'course_id', courseId], ['lesson_versions', 'course_id', courseId],
    ['release_lessons', 'release_id', course.current_release_id],
    ['enrollments', 'course_id', courseId], ['attempts', 'course_id', courseId],
  ];
  async function snapshot() {
    const result = {};
    for (const [table, column, value] of scope) {
      result[table] = await rows(table, column, value, observer, '*', table === 'attempts' ? 'created_at.asc,id.asc' : undefined);
    }
    return result;
  }
  const baseline = await snapshot();
  check(isDeepStrictEqual(Object.fromEntries(Object.entries(baseline).map(([table, values]) => [table, values.length])), { courses: 1, drafts: 1, releases: 1, lesson_versions: 2, release_lessons: 2, enrollments: 1, attempts: 2 }), 'browser_fixture_counts');
  check(baseline.enrollments[0].student_id === sessions.student.id && baseline.attempts.every(attempt => attempt.student_id === sessions.student.id), 'fixture_student_owns_membership_attempts');
  check(baseline.attempts[0].lesson_id === baseline.attempts[1].lesson_id && baseline.attempts[0].lesson_version_id === baseline.attempts[1].lesson_version_id, 'two_attempts_same_first_lesson');
  check(baseline.attempts[0].response.score.correct === 0 && baseline.attempts[1].response.score.correct === baseline.attempts[1].response.score.total, 'original_attempt_then_voluntary_correction');

  const studentRows = {};
  const outsiderRows = {};
  for (const [table, column, value] of scope) {
    studentRows[table] = await rows(table, column, value, { token: sessions.student.token });
    outsiderRows[table] = await rows(table, column, value, { token: sessions.outsider.token });
    check(outsiderRows[table].length === 0, `outsider_${table}_empty`);
  }
  const studentCounts = Object.fromEntries(Object.entries(studentRows).map(([table, values]) => [table, values.length]));
  check(isDeepStrictEqual(studentCounts, { courses: 0, drafts: 0, releases: 1, lesson_versions: 2, release_lessons: 2, enrollments: 1, attempts: 2 }), 'student_rls_exact_counts');
  check(studentRows.attempts.every(attempt => attempt.student_id === sessions.student.id) && new Set(studentRows.attempts.map(attempt => attempt.id)).size === 2, 'student_attempts_only_own');
  check(studentRows.releases[0].id === course.current_release_id && noAnswerKeys(studentRows.lesson_versions), 'student_current_release_no_answer_keys');
  summary.studentRows = studentCounts;
  summary.outsiderRows = Object.fromEntries(Object.entries(outsiderRows).map(([table, values]) => [table, values.length]));

  const outline = await rpc('api_outline', { p_course_id: courseId }, sessions.student.token);
  check(outline.ok && outline.data?.courseProgress?.completed === 1 && outline.data.courseProgress.total === 2 && typeof outline.data.courseProgress.nextLessonId === 'string', 'student_progress_one_of_two');
  check(outline.data.units.length === 1 && outline.data.units[0].lessons.length === 2 && outline.data.units[0].lessons[0].completed && !outline.data.units[0].lessons[1].completed && outline.data.courseProgress.nextLessonId === outline.data.units[0].lessons[1].id, 'student_next_lesson_second');
  summary.denials = {
    outsiderOutline: deniedDomain(await rpc('api_outline', { p_course_id: courseId }, sessions.outsider.token), 404, 'not_found', 'outsider_outline_denied'),
    studentTeacher: deniedDomain(await rpc('api_get_draft', { p_course_id: courseId }, sessions.student.token), 403, 'forbidden', 'student_teacher_rpc_denied'),
    // This targets the already-existing enrollment; even a broken authorization check cannot create another one.
    studentAdmin: deniedDomain(await rpc('api_enroll', { p_course_id: courseId, p_student_email: fixture.student }, sessions.student.token), 403, 'forbidden', 'student_admin_rpc_denied'),
  };

  summary.anonymous = {};
  for (const [table, column, value] of scope) {
    const response = await request(tablePath(table, column, value));
    check(!response.ok && [401, 403].includes(response.status) && response.data?.code === '42501', `anonymous_${table}_denied`);
    summary.anonymous[table] = { status: response.status, code: response.data.code };
  }
  const anonRpc = await rpc('api_outline', { p_course_id: courseId });
  check(!anonRpc.ok && [401, 403].includes(anonRpc.status) && anonRpc.data?.code === '42501', 'anonymous_rpc_denied');
  summary.anonymous.outline = { status: anonRpc.status, code: anonRpc.data.code };
  summary.privateSchema = {};
  for (const identity of ['student', 'outsider']) {
    const response = await request('/rest/v1/answer_keys?select=lesson_version_id&limit=1', { token: sessions[identity].token, schema: 'private' });
    check(!response.ok && response.data?.code === 'PGRST106', `${identity}_private_schema_not_exposed`);
    summary.privateSchema[identity] = { status: response.status, code: response.data.code };
  }

  const original = baseline.attempts[0];
  check(original.response.attemptId === original.id && typeof original.idempotency_key === 'string' && original.request_body?.lessonVersionId === original.lesson_version_id, 'persisted_original_replay_ready');
  const replayArgs = { p_course_id: courseId, p_lesson_id: original.lesson_id, p_key: original.idempotency_key, p_body: original.request_body };
  // Two overlapping real HTTP calls; neither supplies a fresh key or altered answer.
  const concurrent = await Promise.all([rpc('api_attempt', replayArgs, sessions.student.token), rpc('api_attempt', replayArgs, sessions.student.token)]);
  for (const [index, result] of concurrent.entries()) {
    check(result.status === 200 && result.data?.created === false && result.data?.data?.attemptId === original.id && isDeepStrictEqual(result.data.data, original.response), `concurrent_replay_${index + 1}_original_response`);
  }
  const after = await snapshot();
  for (const [table, beforeRows] of Object.entries(baseline)) {
    const stableSort = values => [...values].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    check(isDeepStrictEqual(stableSort(beforeRows), stableSort(after[table])), `${table}_unchanged_after_checks`);
  }
  const afterOutline = await rpc('api_outline', { p_course_id: courseId }, sessions.student.token);
  check(afterOutline.ok && isDeepStrictEqual(afterOutline.data, outline.data), 'outline_and_progress_unchanged');
  summary.replays = { requests: 2, statuses: concurrent.map(result => result.status), sameAttempt: true, originalResponse: true, created: false, attemptsBefore: baseline.attempts.length, attemptsAfter: after.attempts.length };
  summary.progress = { completed: afterOutline.data.courseProgress.completed, total: afterOutline.data.courseProgress.total, nextLessonUnchanged: true };
  summary.unchangedTables = Object.keys(baseline);
  summary.result = 'passed';
}

try {
  await main();
} catch (error) {
  summary.result = 'failed';
  summary.failedCheck = error instanceof AuditFailure ? error.message : 'unexpected_audit_error';
  process.exitCode = 1;
}
summary.checkedAt = new Date().toISOString();
try {
  const reportDirectory = new URL('../test-results/', import.meta.url);
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(new URL('hosted-security.json', reportDirectory), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
} catch {
  summary.result = 'failed';
  summary.failedCheck = 'cannot_write_sanitized_result';
  process.exitCode = 1;
}
console.log(JSON.stringify(summary, null, 2));
