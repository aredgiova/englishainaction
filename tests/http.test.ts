import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DomainError } from '../src/lib/errors';
import { POST as attempt } from '../src/app/api/v1/courses/[courseId]/lessons/[lessonId]/attempts/route';
import { GET as me } from '../src/app/api/v1/me/route';
import { PUT as save } from '../src/app/api/v1/courses/[courseId]/draft/route';

const mocks = vi.hoisted(() => ({ session: vi.fn(), submit: vi.fn(), me: vi.fn(), save: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../src/lib/repository', () => ({ sessionRepository: mocks.session }));
vi.mock('../src/lib/services', () => ({ submitAttempt: mocks.submit, getMe: mocks.me, saveDraft: mocks.save }));
const courseId = '11111111-1111-4111-8111-111111111111';
const lessonVersionId = '22222222-2222-4222-8222-222222222222';
const payload = { lessonVersionId, answers: [{ activityId: 'origin', optionId: 'yopal' }] };
const context = { params: Promise.resolve({ courseId, lessonId: 'intro' }) };
function request(body: unknown, headers: Record<string, string> = {}, method = 'POST') {
  return new NextRequest(`http://127.0.0.1:3000/api/v1/courses/${courseId}/lessons/intro/attempts`, {
    method, headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json', 'idempotency-key': 'retry-123456', ...headers }, body: JSON.stringify(body)
  });
}
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('APP_URL', 'http://127.0.0.1:3000'); mocks.session.mockResolvedValue({}); });

describe('REST adapter, session and write origin protection', () => {
  it('denies cross-origin cookie writes before any mutation', async () => {
    const response = await attempt(request(payload, { origin: 'https://foreign.test' }), context);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'invalid_origin', message: 'El origen de la solicitud no está permitido.' } });
    expect(mocks.submit).not.toHaveBeenCalled(); expect(mocks.session).not.toHaveBeenCalled();
    expect((await attempt(request(payload, { 'sec-fetch-site': 'cross-site' }), context)).status).toBe(403);
  });
  it('requires an authenticated session, with private no-store errors', async () => {
    mocks.session.mockRejectedValue(new DomainError(401, 'unauthenticated', 'Inicia sesión para continuar.'));
    const response = await me(new NextRequest('http://127.0.0.1:3000/api/v1/me'));
    expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.me).not.toHaveBeenCalled();
  });
  it('returns 201 for a new attempt and 200 with the original result on replay', async () => {
    const result = { attemptId: '33333333-3333-4333-8333-333333333333', score: { correct: 1, total: 1 }, items: [{ activityId: 'origin', correct: true, feedback: 'Lina is from Yopal.' }], courseProgress: { completed: 1, total: 2, nextLessonId: 'classmate' } };
    mocks.submit.mockResolvedValueOnce({ data: result, created: true }).mockResolvedValueOnce({ data: result, created: false });
    const first = await attempt(request(payload), context);
    const repeat = await attempt(request(payload), context);
    expect(first.status).toBe(201); expect(repeat.status).toBe(200);
    expect(await first.json()).toEqual({ data: result }); expect(await repeat.json()).toEqual({ data: result });
    expect(mocks.submit).toHaveBeenCalledWith(courseId, 'intro', 'retry-123456', payload);
    expect(first.headers.get('cache-control')).toBe('private, no-store');
  });
  it('returns field errors for invalid bodies or missing retry keys without grading', async () => {
    const response = await attempt(request({ ...payload, answers: [payload.answers[0], payload.answers[0]] }), context);
    expect(response.status).toBe(422); expect((await response.json()).error.fieldErrors).toHaveProperty('answers.1.activityId');
    const missing = request(payload); missing.headers.delete('idempotency-key');
    expect((await attempt(missing, context)).status).toBe(422);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it('keeps domain conflict and resource isolation HTTP semantics', async () => {
    for (const [status, code] of [[409, 'lesson_changed'], [404, 'not_found']] as const) {
      mocks.submit.mockRejectedValueOnce(new DomainError(status, code, 'Solicitud rechazada.'));
      const response = await attempt(request(payload), context);
      expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: { code, message: 'Solicitud rechazada.' } });
    }
  });
  it('rejects malformed JSON and unexpected fields before saving', async () => {
    const malformed = new NextRequest('http://127.0.0.1:3000/api/v1/courses/id/draft', { method: 'PUT', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: '{' });
    const response = await save(malformed, { params: Promise.resolve({ courseId }) });
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe('invalid_json');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('limits streamed bodies even when Content-Length is missing', async () => {
    const oversized = new NextRequest('http://127.0.0.1:3000/api/v1/courses/id/draft', { method: 'PUT', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify({ value: 'a'.repeat(524288) }) });
    const response = await save(oversized, { params: Promise.resolve({ courseId }) });
    expect(response.status).toBe(422); expect((await response.json()).error.code).toBe('body_too_large');
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
