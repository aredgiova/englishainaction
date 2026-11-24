import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import { profileSchema, courseSummarySchema, draftSchema, outlineSchema, lessonSchema, attemptResultSchema } from '../src/lib/contracts';
import { adventureCourseDocument } from '../src/lib/adventure-templates';

// This executes the production migration in real embedded PostgreSQL. Supabase
// Auth's users table and JWT claim are the only test fixtures, not domain mocks.
let db: PGlite;
const actors = {
  admin: '00000000-0000-4000-8000-000000000001',
  teacher: '00000000-0000-4000-8000-000000000002',
  student: '00000000-0000-4000-8000-000000000003',
  outsider: '00000000-0000-4000-8000-000000000004',
  teacher2: '00000000-0000-4000-8000-000000000005',
};
type Actor = keyof typeof actors;
type Progress = { completed: number; total: number; nextLessonId: string | null };
type Attempt = { attemptId: string; score: { correct: number; total: number }; items: { activityId: string; correct: boolean; feedback: string }[]; courseProgress: Progress };
type Write<T> = { data: T; created: boolean };
type Lesson = { lessonVersionId: string; title: string; activities: Record<string, unknown>[] };
type Outline = { courseProgress: Progress; units: { lessons: { id: string; lessonVersionId: string; completed: boolean }[] }[] };

function document() {
  return {
    title: 'First Conversations', level: 'A1', audience: 'university',
    units: [{ id: 'first-steps', title: 'Meeting people', lessons: [
      { id: 'intro', title: 'Introducing yourself', objective: 'Introduce yourself and name your home city.',
        blocks: [{ id: 'dialogue', type: 'text', text: 'Lina: Hi! I am Lina. I am from Yopal.\nSam: Nice to meet you, Lina.' }],
        activities: [{ id: 'origin', type: 'choice', required: true, prompt: 'Where is Lina from?',
          options: [{ id: 'yopal', text: 'Yopal' }, { id: 'cali', text: 'Cali' }], correctOptionId: 'yopal',
          feedback: { correct: 'Lina says she is from Yopal.', incorrect: 'Listen to Lina: I am from Yopal.' } }] },
      { id: 'classmate', title: 'Introducing a classmate', objective: 'Introduce a classmate using a name and subject.',
        blocks: [{ id: 'dialogue', type: 'text', text: 'Lina: This is Sam. He studies art.\nSam: Hello, everyone!' }],
        activities: [{ id: 'subject', type: 'choice', required: true, prompt: 'What does Sam study?',
          options: [{ id: 'art', text: 'Art' }, { id: 'math', text: 'Math' }], correctOptionId: 'art',
          feedback: { correct: 'Sam studies art.', incorrect: 'Lina says: He studies art.' } }] },
    ] }],
  };
}
async function act(actor: Actor | null) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ? actors[actor] : '']);
  await db.exec('set role authenticated');
}
async function rpc<T>(name: string, args: unknown[] = []): Promise<T> {
  const result = await db.query<{ value: T }>(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(',')}) value`, args);
  const value = result.rows[0].value;
  const validators: Record<string, { parse(input: unknown): unknown }> = {
    api_me: profileSchema, api_courses: courseSummarySchema.array(), api_get_draft: draftSchema,
    api_outline: outlineSchema, api_lesson: lessonSchema,
  };
  validators[name]?.parse(value);
  if (name === 'api_attempt') attemptResultSchema.parse((value as Write<Attempt>).data);
  return value;
}
async function fault(operation: Promise<unknown>, status: number, code: string) {
  try { await operation; expect.fail('The operation should have been rejected'); }
  catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(JSON.parse((error as Error).message)).toMatchObject({ status, code });
  }
}
async function course(enroll = true) {
  await act('teacher');
  const created = await rpc<{ courseId: string; revision: number }>('api_create_course', [document()]);
  const publication = await rpc<Write<{ releaseId: string }>>('api_publish', [created.courseId, 1]);
  if (enroll) { await act('admin'); await rpc('api_enroll', [created.courseId, 'student@example.test']); }
  await act('student');
  return { ...created, releaseId: publication.data.releaseId };
}
async function submit(courseId: string, key: string, option = 'yopal', version?: string) {
  const lesson = version ? { lessonVersionId: version } : await rpc<Lesson>('api_lesson', [courseId, 'intro']);
  return rpc<Write<Attempt>>('api_attempt', [courseId, 'intro', key, { lessonVersionId: lesson.lessonVersionId, answers: [{ activityId: 'origin', optionId: option }] }]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text not null, raw_user_meta_data jsonb not null default '{}', email_confirmed_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  const migrations = new URL('../supabase/migrations/', import.meta.url);
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, migrations), 'utf8'));
  }
  for (const [name, id] of Object.entries(actors)) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, `${name}@example.test`, { name, role: 'admin' }]);
    if (['admin', 'teacher', 'teacher2'].includes(name)) {
      await db.query('update public.profiles set role=$1 where id=$2', [name === 'admin' ? 'admin' : 'teacher', id]);
    }
  }
}, 60_000);
afterAll(async () => { await db?.close(); });

describe('Phase 1 PostgreSQL integration and authorization', () => {
  it('saves and publishes the actual adventure template, then grades all 78 answers across 16 lessons', async () => {
    await act('teacher');
    const { title, level, audience } = adventureCourseDocument;
    const created = await rpc<{ courseId: string; revision: number }>('api_create_course', [{ title, level, audience, units: [] }]);
    const saved = await rpc<{ revision: number }>('api_save_draft', [created.courseId, created.revision, adventureCourseDocument]);
    expect(saved.revision).toBe(2);
    expect(draftSchema.parse(await rpc('api_get_draft', [created.courseId])).document).toEqual(adventureCourseDocument);
    expect((await db.query('select id from public.releases where course_id=$1', [created.courseId])).rows).toHaveLength(0);
    await rpc('api_publish', [created.courseId, saved.revision]);
    await act('admin');
    await rpc('api_enroll', [created.courseId, 'student@example.test']);
    await act('student');
    const outline = outlineSchema.parse(await rpc('api_outline', [created.courseId]));
    expect(outline.units).toHaveLength(2);
    expect(outline.courseProgress).toMatchObject({ completed: 0, total: 16 });

    const lessons = adventureCourseDocument.units.flatMap(unit => unit.lessons);
    let totalAnswers = 0;
    for (const [index, source] of lessons.entries()) {
      const lesson = lessonSchema.parse(await rpc('api_lesson', [created.courseId, source.id]));
      expect(JSON.stringify(lesson)).not.toMatch(/correctOptionId|"feedback"/);
      const attempt = await rpc<Write<Attempt>>('api_attempt', [created.courseId, source.id, `adventure-${index}`, {
        lessonVersionId: lesson.lessonVersionId,
        answers: source.activities.map(activity => ({ activityId: activity.id, optionId: activity.correctOptionId })),
      }]);
      totalAnswers += source.activities.length;
      expect(attempt.data.score).toEqual({ correct: source.activities.length, total: source.activities.length });
      expect(attempt.data.courseProgress.completed).toBe(index + 1);
    }
    expect(totalAnswers).toBe(78);
    expect((await rpc<Outline>('api_outline', [created.courseId])).courseProgress).toEqual({ completed: 16, total: 16, nextLessonId: null });
  });

  it('ignores role metadata and enforces authenticated server roles', async () => {
    await act('student');
    expect(await rpc('api_me')).toMatchObject({ id: actors.student, role: 'student' });
    await fault(rpc('api_create_course', [document()]), 403, 'forbidden');
    await db.exec('reset role');
    await db.query('update public.profiles set active=false where id=$1', [actors.outsider]);
    await act('outsider');
    await fault(rpc('api_me'), 403, 'account_inactive');
    await db.exec('reset role');
    await db.query('update public.profiles set active=true where id=$1', [actors.outsider]);
    await act(null);
    await fault(rpc('api_me'), 401, 'unauthenticated');
  });

  it('allows explicit service-role provisioning without allowing student profile writes', async () => {
    await db.exec('reset role; set role service_role');
    await db.query(`insert into public.profiles(id,name,email,role,active) values($1,$2,$3,'student',true)
      on conflict(id) do update set name=excluded.name`, [actors.outsider, 'Unenrolled student', 'outsider@example.test']);
    expect((await db.query<{ name: string }>('select name from public.profiles where id=$1', [actors.outsider])).rows[0].name).toBe('Unenrolled student');
    await act('student');
    await expect(db.query("update public.profiles set name='Changed' where id=$1", [actors.student])).rejects.toThrow(/permission denied/);
    await expect(db.query('delete from public.profiles where id=$1', [actors.student])).rejects.toThrow(/permission denied/);
  });

  it('commits or rolls back course creation and its private seed marker together', async () => {
    await db.exec('reset role');
    async function register(commit: boolean) {
      await db.exec('begin');
      await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['english-in-action:seed:test-v1']);
      await db.exec('set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actors.teacher]);
      const created = await rpc<{ courseId: string }>('api_create_course', [document()]);
      await db.exec('reset role');
      await db.query('insert into private.seed_registry(seed_key,course_id) values($1,$2)', ['test-v1', created.courseId]);
      await db.exec(commit ? 'commit' : 'rollback');
      return created.courseId;
    }
    const rolledBack = await register(false);
    expect((await db.query('select * from private.seed_registry where seed_key=$1', ['test-v1'])).rows).toHaveLength(0);
    expect((await db.query('select id from public.courses where id=$1', [rolledBack])).rows).toHaveLength(0);
    const committed = await register(true);
    expect((await db.query('select course_id from private.seed_registry where seed_key=$1', ['test-v1'])).rows).toEqual([{ course_id: committed }]);
    await expect(db.query('insert into private.seed_registry(seed_key,course_id) values($1,$2)', ['test-v1', committed])).rejects.toThrow(/duplicate key/);
    await db.exec('set role service_role');
    expect((await db.query('select course_id from private.seed_registry where seed_key=$1', ['test-v1'])).rows).toEqual([{ course_id: committed }]);
    await act('student');
    await expect(db.query('select * from private.seed_registry')).rejects.toThrow(/permission denied/);
  });

  it('publishes atomically, keeps drafts private, and permits incomplete drafts', async () => {
    await act('teacher');
    const created = await rpc<{ courseId: string }>('api_create_course', [{ title: 'Working draft', level: 'A1', audience: 'school' }]);
    await fault(rpc('api_publish', [created.courseId, 1]), 422, 'invalid_publication');
    const draft = document(); draft.units[0].lessons[0].objective = '';
    expect(await rpc('api_save_draft', [created.courseId, 1, draft])).toEqual({ revision: 2 });
    await fault(rpc('api_publish', [created.courseId, 2]), 422, 'invalid_publication');
    await fault(rpc('api_save_draft', [created.courseId, 1, document()]), 409, 'revision_conflict');
    expect((await db.query('select * from public.releases where course_id=$1', [created.courseId])).rows).toHaveLength(0);
    await act('teacher2');
    await fault(rpc('api_get_draft', [created.courseId]), 404, 'not_found');
    expect((await db.query('select * from public.drafts where course_id=$1', [created.courseId])).rows).toHaveLength(0);
    await act('student');
    expect((await db.query('select * from public.drafts')).rows).toHaveLength(0);
  });

  it('keeps published solutions inaccessible through RPC and direct table access', async () => {
    const { courseId } = await course();
    const lesson = await rpc<Lesson>('api_lesson', [courseId, 'intro']);
    expect(lesson.activities[0]).not.toHaveProperty('correctOptionId');
    expect(lesson.activities[0]).not.toHaveProperty('feedback');
    const versions = await db.query<{ document: unknown }>('select document from public.lesson_versions where course_id=$1', [courseId]);
    expect(versions.rows).toHaveLength(2);
    expect(JSON.stringify(versions.rows)).not.toContain('correctOptionId');
    expect(JSON.stringify(versions.rows)).not.toContain('feedback');
    await expect(db.query('select content_hash from public.lesson_versions')).rejects.toThrow(/does not exist/);
    await expect(db.query('select * from private.answer_keys')).rejects.toThrow(/permission denied/);
    await expect(db.query('select private.progress($1,$2)', [courseId, actors.student])).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.profiles set role='admin' where id=$1", [actors.student])).rejects.toThrow(/permission denied/);
    await act('outsider');
    await fault(rpc('api_lesson', [courseId, 'intro']), 404, 'not_found');
    expect((await db.query('select * from public.lesson_versions where course_id=$1', [courseId])).rows).toHaveLength(0);
    expect((await db.query('select * from public.courses where id=$1', [courseId])).rows).toHaveLength(0);
    expect(await rpc('api_courses')).toEqual([]);
    expect((await db.query('select id from public.profiles')).rows).toEqual([{ id: actors.outsider }]);
  });

  it('validates structural constraints at the database boundary, including direct RPC calls', async () => {
    await act('teacher');
    const { courseId } = await rpc<{ courseId: string }>('api_create_course', [document()]);
    const numericId = document();
    (numericId.units[0].lessons[0].blocks[0] as Record<string, unknown>).id = 42;
    const duplicateId = document(); duplicateId.units[0].lessons[1].id = 'intro';
    const malformedId = document(); malformedId.units[0].lessons[0].activities[0].id = 'bad/id';
    const unknownField = document();
    (unknownField.units[0].lessons[0].activities[0].options[0] as Record<string, unknown>).correct = true;
    const oversized = document(); oversized.units[0].lessons[0].blocks[0].text = 'a'.repeat(20_001);
    for (const bad of [numericId, duplicateId, malformedId, unknownField, oversized, { ...document(), secret: 'extra' }]) {
      await fault(rpc('api_save_draft', [courseId, 1, bad]), 422, 'validation_error');
    }
    const missingSolution = document(); missingSolution.units[0].lessons[0].activities[0].correctOptionId = 'nonexistent';
    await rpc('api_save_draft', [courseId, 1, missingSolution]);
    await fault(rpc('api_publish', [courseId, 2]), 422, 'invalid_publication');
    expect((await db.query('select * from public.releases where course_id=$1', [courseId])).rows).toHaveLength(0);
    const blankObjective = document(); blankObjective.units[0].lessons[0].objective = '\n\t\r';
    await rpc('api_save_draft', [courseId, 2, blankObjective]);
    await fault(rpc('api_publish', [courseId, 3]), 422, 'invalid_publication');
  });

  it('does not expose unpublished course metadata through student table reads', async () => {
    const { courseId, releaseId } = await course();
    await act('teacher');
    const unpublished = { ...document(), title: 'Private upcoming course title', level: 'B2', audience: 'professional' };
    await rpc('api_save_draft', [courseId, 1, unpublished]);
    const metadataQuery = 'select id,title,level,audience from public.courses where id=$1';
    expect((await db.query(metadataQuery, [courseId])).rows).toEqual([
      { id: courseId, title: unpublished.title, level: unpublished.level, audience: unpublished.audience },
    ]);

    await act('student');
    const listed = await rpc<{ courseId: string; title: string; level: string; audience: string; revision: number }[]>('api_courses');
    expect(listed.find(item => item.courseId === courseId)).toMatchObject({ title: 'First Conversations', level: 'A1', audience: 'university', revision: 1 });
    expect((await db.query(metadataQuery, [courseId])).rows).toEqual([]);
    // Restricting the draft metadata table must preserve access to the current
    // publication through both authorized RPCs and dependent RLS policies.
    expect((await db.query('select id from public.releases where id=$1', [releaseId])).rows).toEqual([{ id: releaseId }]);
    expect((await db.query('select id from public.lesson_versions where course_id=$1', [courseId])).rows).toHaveLength(2);
    expect((await db.query('select lesson_id from public.release_lessons where release_id=$1', [releaseId])).rows).toHaveLength(2);
    expect((await rpc<Outline>('api_outline', [courseId])).units[0].lessons).toHaveLength(2);
    expect((await rpc<Lesson>('api_lesson', [courseId, 'intro'])).title).toBe('Introducing yourself');

    await act('outsider');
    expect((await db.query('select id from public.releases where id=$1', [releaseId])).rows).toEqual([]);
    expect((await db.query('select id from public.lesson_versions where course_id=$1', [courseId])).rows).toEqual([]);
    expect((await db.query('select lesson_id from public.release_lessons where release_id=$1', [releaseId])).rows).toEqual([]);
  });

  it('records 1/2 progress even for an incorrect answer and replays exactly one attempt', async () => {
    const { courseId } = await course();
    const first = await submit(courseId, 'wrong-answer', 'cali');
    expect(first.created).toBe(true);
    expect(first.data.score).toEqual({ correct: 0, total: 1 });
    expect(first.data.items[0]).toMatchObject({ correct: false, feedback: 'Listen to Lina: I am from Yopal.' });
    expect(first.data.courseProgress).toEqual({ completed: 1, total: 2, nextLessonId: 'classmate' });
    // Simulate a new session: all progress comes from persisted rows.
    await act(null); await act('student');
    expect((await rpc<Outline>('api_outline', [courseId])).courseProgress).toEqual(first.data.courseProgress);
    const repeat = await submit(courseId, 'wrong-answer', 'cali');
    expect(repeat).toEqual({ created: false, data: first.data });
    expect((await db.query('select * from public.attempts where course_id=$1', [courseId])).rows).toHaveLength(1);
    await fault(submit(courseId, 'wrong-answer', 'yopal'), 409, 'idempotency_conflict');
    const voluntary = await submit(courseId, 'new-practice');
    expect(voluntary.data.attemptId).not.toBe(first.data.attemptId);
    expect(voluntary.data.score).toEqual({ correct: 1, total: 1 });
    expect(voluntary.data.courseProgress.completed).toBe(1);
    await act('outsider');
    expect((await db.query('select * from public.attempts where course_id=$1', [courseId])).rows).toHaveLength(0);
  });

  it('rejects missing, duplicate, unknown and forged answers without inserting attempts', async () => {
    const { courseId } = await course();
    const { lessonVersionId } = await rpc<Lesson>('api_lesson', [courseId, 'intro']);
    const invalidAnswers = [[], [{ activityId: 'origin', optionId: 'missing' }], [{ activityId: 'foreign', optionId: 'yopal' }],
      [{ activityId: 'origin', optionId: 'yopal' }, { activityId: 'origin', optionId: 'cali' }],
      [{ activityId: 'origin', optionId: 'yopal', correct: true }]];
    for (const answers of invalidAnswers) await fault(rpc('api_attempt', [courseId, 'intro', 'invalid-request', { lessonVersionId, answers }]), 422, 'validation_error');
    await fault(rpc('api_attempt', [courseId, 'intro', '', { lessonVersionId, answers: [] }]), 422, 'validation_error');
    expect((await db.query('select * from public.attempts where course_id=$1', [courseId])).rows).toHaveLength(0);
  });

  it('preserves versions on reorder, isolates draft edits, and preserves history on republish', async () => {
    const { courseId, releaseId } = await course();
    const before = await rpc<Lesson>('api_lesson', [courseId, 'intro']);
    const first = await submit(courseId, 'historical');
    await act('teacher');
    expect(await rpc('api_publish', [courseId, 1])).toEqual({ created: false, data: { releaseId } });
    const reordered = document(); reordered.units[0].lessons.reverse();
    await rpc('api_save_draft', [courseId, 1, reordered]); await rpc('api_publish', [courseId, 2]);
    await act('student');
    expect((await rpc<Lesson>('api_lesson', [courseId, 'intro'])).lessonVersionId).toBe(before.lessonVersionId);
    expect((await rpc<Outline>('api_outline', [courseId])).units[0].lessons.map(x => x.id)).toEqual(['classmate', 'intro']);
    await act('teacher');
    const updated = document(); updated.units[0].lessons[0].objective = 'Say your name and home city in two clear sentences.';
    await rpc('api_save_draft', [courseId, 2, updated]);
    await act('student');
    expect((await rpc<Lesson>('api_lesson', [courseId, 'intro'])).lessonVersionId).toBe(before.lessonVersionId);
    await act('teacher'); await rpc('api_publish', [courseId, 3]);
    await act('student');
    expect((await rpc<Lesson>('api_lesson', [courseId, 'intro'])).lessonVersionId).not.toBe(before.lessonVersionId);
    expect((await rpc<Outline>('api_outline', [courseId])).courseProgress.completed).toBe(0);
    await fault(submit(courseId, 'stale-new-request', 'yopal', before.lessonVersionId), 409, 'lesson_changed');
    expect(await submit(courseId, 'historical', 'yopal', before.lessonVersionId)).toEqual({ created: false, data: first.data });
    expect((await db.query('select * from public.attempts where course_id=$1', [courseId])).rows).toHaveLength(1);
    // Replay precedes later enrollment changes as well as version changes.
    await db.exec('reset role'); await db.query('delete from public.enrollments where course_id=$1', [courseId]);
    await act('student');
    expect(await submit(courseId, 'historical', 'yopal', before.lessonVersionId)).toEqual({ created: false, data: first.data });
    await fault(submit(courseId, 'not-enrolled-new', 'yopal', before.lessonVersionId), 404, 'not_found');
  });

  it('keeps enrollment unique and scopes publication access to its author', async () => {
    const { courseId } = await course(false);
    await act('admin');
    const one = await rpc<Write<{ enrollmentId: string }>>('api_enroll', [courseId, 'student@example.test']);
    const two = await rpc<Write<{ enrollmentId: string }>>('api_enroll', [courseId, 'STUDENT@example.test']);
    expect(one.created).toBe(true); expect(two.created).toBe(false); expect(two.data).toEqual(one.data);
    await fault(rpc('api_enroll', [courseId, 'teacher@example.test']), 404, 'student_not_found');
    await act('teacher2'); await fault(rpc('api_publish', [courseId, 1]), 404, 'not_found');
    await act('teacher'); await fault(rpc('api_enroll', [courseId, 'outsider@example.test']), 403, 'forbidden');
    await expect(db.query('update public.releases set revision=99 where course_id=$1', [courseId])).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await expect(db.query('update public.releases set revision=99 where course_id=$1', [courseId])).rejects.toThrow(/immutable/);
  });

  it('requires an active student to verify their email before enrollment', async () => {
    const { courseId } = await course(false);
    const pendingId = '00000000-0000-4000-8000-000000000098';
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,null)', [pendingId, 'pending-student@example.test']);
    expect((await db.query('select role,active from public.profiles where id=$1', [pendingId])).rows).toEqual([{ role: 'student', active: true }]);
    await act('admin');
    await fault(rpc('api_enroll', [courseId, 'pending-student@example.test']), 404, 'student_not_found');
    expect((await db.query('select id from public.enrollments where course_id=$1', [courseId])).rows).toHaveLength(0);
    await db.exec('reset role');
    await db.query('update auth.users set email_confirmed_at=now() where id=$1', [pendingId]);
    await act('admin');
    expect(await rpc('api_enroll', [courseId, 'pending-student@example.test'])).toMatchObject({ created: true, data: { studentId: pendingId } });
  });

  it('serializes duplicate publish, enrollment and grading requests to one durable record', async () => {
    // PGlite has one PostgreSQL connection. These overlapping requests exercise
    // queued RPCs and unique constraints, not a multi-connection contention test.
    await act('teacher');
    const { courseId } = await rpc<{ courseId: string }>('api_create_course', [document()]);
    const publications = await Promise.all([
      rpc<Write<{ releaseId: string }>>('api_publish', [courseId, 1]),
      rpc<Write<{ releaseId: string }>>('api_publish', [courseId, 1]),
    ]);
    expect(publications.filter(x => x.created)).toHaveLength(1);
    expect(publications[0].data).toEqual(publications[1].data);
    expect((await db.query('select id from public.releases where course_id=$1', [courseId])).rows).toHaveLength(1);
    await act('admin');
    const enrollments = await Promise.all([
      rpc<Write<{ enrollmentId: string }>>('api_enroll', [courseId, 'student@example.test']),
      rpc<Write<{ enrollmentId: string }>>('api_enroll', [courseId, 'student@example.test']),
    ]);
    expect(enrollments.filter(x => x.created)).toHaveLength(1);
    expect(enrollments[0].data).toEqual(enrollments[1].data);
    await act('student');
    const submissions = await Promise.all([submit(courseId, 'overlapping-request'), submit(courseId, 'overlapping-request')]);
    expect(submissions.filter(x => x.created)).toHaveLength(1);
    expect(submissions[0].data).toEqual(submissions[1].data);
    expect((await db.query('select id from public.attempts where course_id=$1', [courseId])).rows).toHaveLength(1);
  });

  it('reserves invitations once and assigns roles only after an admin verifies the Auth identity', async () => {
    await act('student'); await fault(rpc('api_reserve_invitation', ['invite@example.test', 'teacher']), 403, 'forbidden');
    await act('admin');
    await fault(rpc('api_reserve_invitation', ['invite@example.test', 'admin']), 422, 'validation_error');
    const reserved = await rpc<{ invitationId: string }>('api_reserve_invitation', ['invite@example.test', 'teacher']);
    await fault(rpc('api_reserve_invitation', ['INVITE@example.test', 'student']), 409, 'invitation_pending');
    await fault(rpc('api_finish_invitation', [reserved.invitationId, actors.outsider, null]), 422, 'invitation_mismatch');
    const newId = '00000000-0000-4000-8000-000000000099';
    await db.exec('reset role');
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [newId, 'invite@example.test', { role: 'admin' }]);
    expect((await db.query<{ role: string }>('select role from public.profiles where id=$1', [newId])).rows[0].role).toBe('student');
    await act('admin');
    const finished = await rpc('api_finish_invitation', [reserved.invitationId, newId, null]);
    expect(finished).toMatchObject({ status: 'sent', role: 'teacher' });
    expect(await rpc('api_finish_invitation', [reserved.invitationId, newId, null])).toEqual(finished);
    expect((await db.query<{ role: string }>('select role from public.profiles where id=$1', [newId])).rows[0].role).toBe('teacher');
  });
});

