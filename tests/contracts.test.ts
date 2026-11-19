import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import SwaggerParser from '@apidevtools/swagger-parser';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  ACTIVE_PHASE, attemptResultSchema, attemptSchema, draftDocumentSchema,
  idempotencyKeySchema, invitationSchema, lessonSchema, passwordSchema,
  publishDocumentSchema, saveDraftSchema, type CourseDocument,
} from '../src/lib/contracts';
import { demoDocument } from '../src/lib/demo-content';

const fixture = () => structuredClone(demoDocument);
const courseId = '00000000-0000-4000-8000-000000000001';
const lessonVersionId = '00000000-0000-4000-8000-000000000010';
const firstLesson = (document: CourseDocument) => document.units[0].lessons[0];
type Mutation = (document: CourseDocument) => void;

describe('Fase 1: shared authoring and practice contract', () => {
  it('publishes the actual original seed material with the required A1 university course and two lessons', () => {
    const document = publishDocumentSchema.parse(demoDocument);
    expect(document).toMatchObject({ title: 'First Conversations', level: 'A1', audience: 'university' });
    expect(document.units.flatMap((unit) => unit.lessons).map((lesson) => lesson.title)).toEqual([
      'Introducing yourself', 'Introducing a classmate',
    ]);
  });

  it('allows pedagogically incomplete drafts while rejecting malformed shapes and unknown types', () => {
    expect(draftDocumentSchema.safeParse({ title: '', level: 'A1', audience: 'school', units: [] }).success).toBe(true);
    const incomplete = fixture();
    firstLesson(incomplete).objective = '';
    firstLesson(incomplete).blocks = [];
    firstLesson(incomplete).activities[0].options = [];
    firstLesson(incomplete).activities[0].correctOptionId = '';
    expect(draftDocumentSchema.safeParse(incomplete).success).toBe(true);
    expect(publishDocumentSchema.safeParse(incomplete).success).toBe(false);
    expect(draftDocumentSchema.safeParse({ ...incomplete, units: {} }).success).toBe(false);
    expect(draftDocumentSchema.safeParse({ ...incomplete, ownerId: courseId }).success).toBe(false);
    const lesson = firstLesson(fixture());
    expect(draftDocumentSchema.safeParse({ ...fixture(), units: [{ id: 'u', title: '', lessons: [{ ...lesson, blocks: [{ id: 'b', type: 'audio', url: 'private' }] }] }] }).success).toBe(false);
  });

  const duplicateCases: [string, Mutation][] = [
    ['units', (document) => { document.units.push({ ...structuredClone(document.units[0]), lessons: [] }); }],
    ['lessons across different units', (document) => { document.units.push({ id: 'other-unit', title: '', lessons: [structuredClone(firstLesson(document))] }); }],
    ['blocks in one lesson', (document) => { firstLesson(document).blocks.push(structuredClone(firstLesson(document).blocks[0])); }],
    ['activities in one lesson', (document) => { firstLesson(document).activities.push(structuredClone(firstLesson(document).activities[0])); }],
    ['options in one activity', (document) => { const activity = firstLesson(document).activities[0]; activity.options.push(structuredClone(activity.options[0])); }],
  ];
  it.each(duplicateCases)('rejects duplicate identifiers in %s before saving', (_name, mutate) => {
    const document = fixture();
    mutate(document);
    const result = saveDraftSchema.safeParse({ expectedRevision: 1, document });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.at(-1) === 'id')).toBe(true);
  });

  const incompleteCases: [string, Mutation][] = [
    ['course title', (document) => { document.title = '  '; }],
    ['course units', (document) => { document.units = []; }],
    ['unit title', (document) => { document.units[0].title = ''; }],
    ['lessons per unit', (document) => { document.units[0].lessons = []; }],
    ['lesson objective', (document) => { firstLesson(document).objective = '\n'; }],
    ['lesson content', (document) => { firstLesson(document).blocks = []; }],
    ['nonblank text', (document) => { firstLesson(document).blocks[0].text = ' '; }],
    ['mandatory practice', (document) => { firstLesson(document).activities[0].required = false; }],
    ['activity prompt', (document) => { firstLesson(document).activities[0].prompt = ''; }],
    ['at least two options', (document) => { firstLesson(document).activities[0].options = [firstLesson(document).activities[0].options[0]]; }],
    ['nonblank options', (document) => { firstLesson(document).activities[0].options[0].text = ''; }],
    ['existing answer key', (document) => { firstLesson(document).activities[0].correctOptionId = 'nonexistent'; }],
    ['correct feedback', (document) => { firstLesson(document).activities[0].feedback.correct = ''; }],
    ['incorrect feedback', (document) => { firstLesson(document).activities[0].feedback.incorrect = ''; }],
  ];
  it.each(incompleteCases)('requires %s for publication but allows editing it as a draft', (_name, mutate) => {
    const document = fixture();
    mutate(document);
    expect(draftDocumentSchema.safeParse(document).success).toBe(true);
    expect(publishDocumentSchema.safeParse(document).success).toBe(false);
  });

  it('rejects repeated answers, unsupported answer types and spoofed result fields', () => {
    const answer = { activityId: 'origin', optionId: 'yopal' };
    expect(attemptSchema.safeParse({ lessonVersionId, answers: [answer] }).success).toBe(true);
    expect(attemptSchema.safeParse({ lessonVersionId, answers: [answer, answer] }).success).toBe(false);
    expect(attemptSchema.safeParse({ lessonVersionId, answers: [{ activityId: 'origin', value: 'yopal' }] }).success).toBe(false);
    expect(attemptSchema.safeParse({ lessonVersionId, answers: [answer], score: { correct: 1, total: 1 } }).success).toBe(false);
    expect(idempotencyKeySchema.safeParse('4b09e25f-846a-4452-872c-5a680976a21c').success).toBe(true);
    expect(idempotencyKeySchema.safeParse('x'.repeat(129)).success).toBe(false);
    expect(idempotencyKeySchema.safeParse('bad key with spaces').success).toBe(false);
  });

  it('normalizes invitations, prevents administrator invitation and enforces new-password minimum', () => {
    expect(invitationSchema.parse({ name: ' Lina ', email: ' Lina@Example.test ', role: 'student' })).toEqual({ name: 'Lina', email: 'lina@example.test', role: 'student' });
    expect(invitationSchema.safeParse({ name: 'Admin', email: 'a@example.test', role: 'admin' }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: 'short' }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: 'EnglishDemo2026!' }).success).toBe(true);
  });

  it('uses a closed student lesson schema that rejects solutions and correction feedback', () => {
    const source = firstLesson(fixture());
    const safe = {
      courseId, lessonId: source.id, lessonVersionId, title: source.title,
      objective: source.objective, blocks: source.blocks,
      activities: source.activities.map((activity) => ({ id: activity.id, type: activity.type, prompt: activity.prompt, required: activity.required, options: activity.options })),
    };
    expect(lessonSchema.parse(safe)).toEqual(safe);
    expect(lessonSchema.safeParse({ ...safe, activities: source.activities }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...safe, activities: [{ ...safe.activities[0], feedback: source.activities[0].feedback }] }).success).toBe(false);
  });

  it('keeps grade and completion independent in the correction response', () => {
    expect(attemptResultSchema.parse({
      attemptId: courseId, score: { correct: 0, total: 1 },
      items: [{ activityId: 'origin', correct: false, feedback: 'Lina is from Yopal.' }],
      courseProgress: { completed: 1, total: 2, nextLessonId: 'classmate' },
    })).toMatchObject({ score: { correct: 0, total: 1 }, courseProgress: { completed: 1, total: 2 } });
  });
});

type Operation = { operationId: string; responses: Record<string, unknown>; parameters?: { $ref?: string }[]; security?: unknown[] };
type Contract = { openapi: string; servers: { url: string }[]; paths: Record<string, Record<string, Operation>>; components: { schemas: Record<string, { properties?: Record<string, unknown>; additionalProperties?: boolean }> } };
const contract = YAML.parse(readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8')) as Contract;
const operations: [string, string, string][] = [
  ['/api/v1/auth/login', 'post', '200'], ['/api/v1/auth/logout', 'post', '200'],
  ['/api/v1/auth/recover', 'post', '200'], ['/api/v1/auth/password', 'post', '200'],
  ['/auth/confirm', 'get', '303'], ['/api/v1/me', 'get', '200'],
  ['/api/v1/admin/invitations', 'post', '201'], ['/api/v1/courses', 'get', '200'], ['/api/v1/courses', 'post', '201'],
  ['/api/v1/courses/{courseId}/draft', 'get', '200'], ['/api/v1/courses/{courseId}/draft', 'put', '200'],
  ['/api/v1/courses/{courseId}/releases', 'post', '201'], ['/api/v1/courses/{courseId}/enrollments', 'post', '201'],
  ['/api/v1/courses/{courseId}/outline', 'get', '200'], ['/api/v1/courses/{courseId}/lessons/{lessonId}', 'get', '200'],
  ['/api/v1/courses/{courseId}/lessons/{lessonId}/attempts', 'post', '201'],
];

describe('OpenAPI is a usable phase 1 HTTP contract', () => {
  it('uses the configured local application origin for documented cookie-authenticated requests', () => {
    const environment = parseEnv(readFileSync(new URL('../.env.example', import.meta.url), 'utf8'));
    const { APP_URL: appUrl, E2E_BASE_URL: e2eBaseUrl } = environment;
    if (!appUrl || !e2eBaseUrl) throw new Error('.env.example must define APP_URL and E2E_BASE_URL for the local HTTP contract.');
    const origin = new URL(appUrl).origin;
    expect(contract.servers).toContainEqual(expect.objectContaining({ url: origin }));
    expect(new URL(e2eBaseUrl).origin).toBe(origin);
  });

  it('validates OpenAPI 3.1 and resolves every schema and response reference', async () => {
    expect(ACTIVE_PHASE).toBe(1);
    expect(contract.openapi).toBe('3.1.0');
    await expect(SwaggerParser.validate('docs/openapi.yaml')).resolves.toBeDefined();
  });

  it.each(operations)('documents %s %s with its success and session/origin behavior', (path, method, status) => {
    const operation = contract.paths[path][method];
    expect(operation.operationId).toBeTruthy();
    expect(operation.responses[status]).toBeDefined();
    if (path !== '/auth/confirm') {
      expect(operation.responses['403']).toBeDefined();
      if (operation.security?.length !== 0) expect(operation.responses['401']).toBeDefined();
    }
    if (method !== 'get') expect(operation.parameters).toContainEqual({ $ref: '#/components/parameters/Origin' });
    if (path === '/api/v1/auth/recover') expect(operation.responses['502']).toBeDefined();
  });

  it('documents replays as 200, new attempts as 201, and conflicts as 409', () => {
    for (const suffix of ['releases', 'enrollments', 'lessons/{lessonId}/attempts']) {
      const operation = contract.paths[`/api/v1/courses/{courseId}/${suffix}`].post;
      for (const status of ['200', '201', '409', '422']) expect(operation.responses[status]).toBeDefined();
    }
    expect(contract.paths['/api/v1/courses/{courseId}/lessons/{lessonId}/attempts'].post.parameters).toContainEqual({ $ref: '#/components/parameters/IdempotencyKey' });
  });

  it('does not expose teacher keys or feedback in the student activity response schema', () => {
    const activity = contract.components.schemas.StudentChoiceActivity;
    expect(activity.additionalProperties).toBe(false);
    expect(activity.properties).not.toHaveProperty('correctOptionId');
    expect(activity.properties).not.toHaveProperty('feedback');
    expect(contract.components.schemas.ChoiceActivity.properties).toHaveProperty('correctOptionId');
  });
});
