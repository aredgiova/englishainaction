import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { demoDocument } from '../src/lib/demo-content';
import { attemptResultSchema, courseSummarySchema, draftSchema, lessonSchema, outlineSchema, type AttemptResult, type Lesson, type Outline } from '../src/lib/contracts';

// A disposable PostgreSQL database exercises the actual migration files and RLS.
// auth.users/auth.uid are fixtures only: this does not verify Supabase Auth,
// HTTP cookies, mail delivery, PostgREST, or an existing hosted project.
let db: PGlite;
const actors = {
  admin: '00000000-0000-4000-8000-000000009901',
  teacher: '00000000-0000-4000-8000-000000009902',
  student: '00000000-0000-4000-8000-000000009903',
  outsider: '00000000-0000-4000-8000-000000009904',
};
const relations = [
  'auth.users', 'public.profiles', 'public.courses', 'public.drafts',
  'public.releases', 'public.lesson_versions', 'public.release_lessons',
  'public.enrollments', 'public.attempts', 'private.answer_keys', 'private.seed_registry',
] as const;
type Snapshot = Record<(typeof relations)[number], unknown[]>;
type Write<T> = { data: T; created: boolean };
let beforeRows: Snapshot;
let afterRows: Snapshot;
let courseId: string;
let releaseId: string;
let enrollmentId: string;
let originalLesson: Lesson;
let originalOutline: Outline;
let originalAttempt: AttemptResult;
let exposedBeforeUpgrade: unknown[];
let publishedRevisionBeforeUpgrade: number;
const pendingDocument = structuredClone(demoDocument);
pendingDocument.title = 'Private next edition';
pendingDocument.level = 'B2';
pendingDocument.audience = 'professional';
pendingDocument.units[0].lessons[0].objective = 'Introduce yourself to a new colleague in three clear sentences.';
const originalKey = 'before-upgrade-attempt';

async function act(actor: keyof typeof actors) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actors[actor]]);
  await db.exec('set role authenticated');
}

async function rpc<T>(name: string, args: unknown[] = []): Promise<T> {
  const result = await db.query<{ value: T }>(`select public.${name}(${args.map((_, index) => `$${index + 1}`).join(',')}) value`, args);
  return result.rows[0].value;
}

async function snapshot(): Promise<Snapshot> {
  await db.exec('reset role');
  const rows = {} as Snapshot;
  for (const relation of relations) {
    // Relation names come only from the fixed allowlist above. JSON preserves
    // every column, including stored responses, content, timestamps and IDs.
    const result = await db.query<{ row: unknown }>(`select to_jsonb(t) as row from ${relation} t order by to_jsonb(t)::text`);
    rows[relation] = result.rows.map(item => item.row);
  }
  return rows;
}

function originalBody() {
  return { lessonVersionId: originalLesson.lessonVersionId, answers: [{ activityId: 'origin', optionId: 'tunja' }] };
}

async function fault(operation: Promise<unknown>, status: number, code: string) {
  try { await operation; expect.fail('The database operation should reject this request'); }
  catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect(JSON.parse((error as Error).message)).toMatchObject({ status, code });
  }
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
  await db.exec(await readFile(new URL('../supabase/migrations/202611190001_phase1.sql', import.meta.url), 'utf8'));
  for (const [actor, id] of Object.entries(actors)) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)', [id, `${actor}@upgrade.example.test`, { name: actor, role: 'admin' }]);
    if (actor === 'admin' || actor === 'teacher') await db.query('update public.profiles set role=$1 where id=$2', [actor, id]);
  }

  // Match the local seed's atomic course/marker transaction, before 002 exists.
  await db.exec('begin');
  await db.query('select pg_advisory_xact_lock(hashtextextended($1,0))', ['english-in-action:upgrade-fixture']);
  await db.exec('set local role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actors.teacher]);
  ({ courseId } = await rpc<{ courseId: string }>('api_create_course', [demoDocument]));
  await db.exec('reset role');
  await db.query('insert into private.seed_registry(seed_key,course_id) values($1,$2)', ['upgrade-fixture', courseId]);
  await db.exec('commit');

  await act('teacher');
  ({ releaseId } = (await rpc<Write<{ releaseId: string }>>('api_publish', [courseId, 1])).data);
  await act('admin');
  ({ enrollmentId } = (await rpc<Write<{ enrollmentId: string }>>('api_enroll', [courseId, 'student@upgrade.example.test'])).data);
  await act('student');
  originalLesson = lessonSchema.parse(await rpc('api_lesson', [courseId, 'intro']));
  originalAttempt = attemptResultSchema.parse((await rpc<Write<AttemptResult>>('api_attempt', [courseId, 'intro', originalKey, originalBody()])).data);
  originalOutline = outlineSchema.parse(await rpc('api_outline', [courseId]));
  await act('teacher');
  expect(await rpc('api_save_draft', [courseId, 1, pendingDocument])).toEqual({ revision: 2 });
  await act('student');
  exposedBeforeUpgrade = (await db.query('select id,title,level,audience from public.courses where id=$1', [courseId])).rows;
  publishedRevisionBeforeUpgrade = courseSummarySchema.array().parse(await rpc('api_courses'))[0].revision;

  beforeRows = await snapshot();
  // This is an in-place upgrade with existing data, not a fresh schema/reset.
  await db.exec(await readFile(new URL('../supabase/migrations/202611190002_private_course_metadata.sql', import.meta.url), 'utf8'));
  afterRows = await snapshot();
}, 60_000);

afterAll(async () => { await db?.close(); });

describe('In-place PostgreSQL upgrade from phase 1 migration 001 to 002', () => {
  it('preserves complete users, draft, publication, enrollment, attempt and seed-marker records', () => {
    expect(beforeRows['auth.users']).toHaveLength(4);
    expect(beforeRows['public.profiles']).toHaveLength(4);
    expect(beforeRows['public.releases']).toHaveLength(1);
    expect(beforeRows['public.lesson_versions']).toHaveLength(2);
    expect(beforeRows['public.enrollments']).toHaveLength(1);
    expect(beforeRows['public.attempts']).toHaveLength(1);
    expect(beforeRows['private.seed_registry']).toEqual([{ seed_key: 'upgrade-fixture', course_id: courseId }]);
    expect(originalAttempt.score).toEqual({ correct: 0, total: 1 });
    expect(originalAttempt.courseProgress).toEqual({ completed: 1, total: 2, nextLessonId: 'classmate' });
    expect(afterRows).toEqual(beforeRows);
  });

  it('closes the pre-upgrade draft-metadata leak without breaking authorized publication reads', async () => {
    expect(exposedBeforeUpgrade).toEqual([{ id: courseId, title: pendingDocument.title, level: 'B2', audience: 'professional' }]);
    expect(publishedRevisionBeforeUpgrade).toBe(2);
    await act('student');
    expect((await db.query('select * from public.courses where id=$1', [courseId])).rows).toEqual([]);
    expect((await db.query('select * from public.drafts where course_id=$1', [courseId])).rows).toEqual([]);
    expect(courseSummarySchema.array().parse(await rpc('api_courses'))).toEqual([expect.objectContaining({
      courseId, title: demoDocument.title, level: 'A1', audience: 'university', revision: 1, progress: originalAttempt.courseProgress,
    })]);
    expect(outlineSchema.parse(await rpc('api_outline', [courseId]))).toEqual(originalOutline);
    expect(lessonSchema.parse(await rpc('api_lesson', [courseId, 'intro']))).toEqual(originalLesson);
    expect((await db.query('select id from public.releases where id=$1', [releaseId])).rows).toEqual([{ id: releaseId }]);
    expect((await db.query('select id from public.lesson_versions where course_id=$1', [courseId])).rows).toHaveLength(2);
    expect((await db.query('select lesson_id from public.release_lessons where release_id=$1', [releaseId])).rows).toHaveLength(2);
    await expect(db.query('select * from private.answer_keys')).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.profiles set role='admin' where id=$1", [actors.student])).rejects.toThrow(/permission denied/);

    await act('outsider');
    for (const relation of ['releases', 'lesson_versions', 'attempts']) {
      expect((await db.query(`select * from public.${relation} where course_id=$1`, [courseId])).rows).toEqual([]);
    }
    expect((await db.query('select * from public.release_lessons where release_id=$1', [releaseId])).rows).toEqual([]);
    await fault(rpc('api_lesson', [courseId, 'intro']), 404, 'not_found');
    await act('teacher');
    expect(draftSchema.parse(await rpc('api_get_draft', [courseId]))).toMatchObject({ revision: 2, document: pendingDocument });
    await db.exec('reset role; set role service_role');
    expect((await db.query('select course_id from private.seed_registry where seed_key=$1', ['upgrade-fixture'])).rows).toEqual([{ course_id: courseId }]);
    await db.exec('reset role');
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('anon','private.can_read_current_release(uuid,uuid)','execute') allowed")).rows[0].allowed).toBe(false);
  });

  it('keeps existing replays and enrollments stable and preserves historical attempts on a later publication', async () => {
    await act('student');
    expect(await rpc('api_attempt', [courseId, 'intro', originalKey, originalBody()])).toEqual({ created: false, data: originalAttempt });
    await act('admin');
    expect(await rpc('api_enroll', [courseId, 'student@upgrade.example.test'])).toMatchObject({ created: false, data: { enrollmentId } });
    await act('teacher');
    expect(await rpc('api_publish', [courseId, 1])).toEqual({ created: false, data: { releaseId } });
    const updated = await rpc<Write<{ releaseId: string }>>('api_publish', [courseId, 2]);
    expect(updated.created).toBe(true);
    expect(updated.data.releaseId).not.toBe(releaseId);
    await act('student');
    expect(lessonSchema.parse(await rpc('api_lesson', [courseId, 'intro'])).lessonVersionId).not.toBe(originalLesson.lessonVersionId);
    const outline = outlineSchema.parse(await rpc('api_outline', [courseId]));
    expect(outline.courseProgress).toEqual({ completed: 0, total: 2, nextLessonId: 'intro' });
    expect(outline.units[0].lessons[1].lessonVersionId).toBe(originalOutline.units[0].lessons[1].lessonVersionId);
    expect(await rpc('api_attempt', [courseId, 'intro', originalKey, originalBody()])).toEqual({ created: false, data: originalAttempt });
    await fault(rpc('api_attempt', [courseId, 'intro', 'after-upgrade-stale-version', originalBody()]), 409, 'lesson_changed');
    expect((await db.query('select id from public.releases where id=$1', [releaseId])).rows).toEqual([]);

    const republished = await snapshot();
    expect(republished['public.attempts']).toEqual(beforeRows['public.attempts']);
    expect(republished['public.enrollments']).toEqual(beforeRows['public.enrollments']);
    expect(republished['auth.users']).toEqual(beforeRows['auth.users']);
    expect(republished['private.seed_registry']).toEqual(beforeRows['private.seed_registry']);
    for (const relation of ['public.releases', 'public.lesson_versions', 'private.answer_keys'] as const) {
      for (const historical of beforeRows[relation]) expect(republished[relation]).toContainEqual(historical);
    }
  });
});
