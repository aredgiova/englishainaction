import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import YAML from 'yaml';
import { DomainError } from '../src/lib/errors';
import { GET as access } from '../src/app/api/v1/adventure/access/route';
import { GET as members } from '../src/app/api/v1/adventure/members/route';
import { PUT as setAccess } from '../src/app/api/v1/adventure/members/[userId]/route';
import { GET as progress, PUT as setProgress, DELETE as resetProgress } from '../src/app/api/v1/adventure/progress/[missionId]/route';
import { requireAdventureAccess } from '../src/lib/adventure-access';
import { adventureProgressSchema } from '../src/lib/adventure-access-contracts';

const mocks = vi.hoisted(() => ({ session: vi.fn(), call: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../src/lib/repository', () => ({ sessionRepository: mocks.session }));
const origin = 'http://127.0.0.1:3000';
const userId = '11111111-1111-4111-8111-111111111111';
const memberContext = { params: Promise.resolve({ userId }) };
const missionContext = { params: Promise.resolve({ missionId: 'hello-explorer' }) };
const completed = { missionId: 'hello-explorer', completedStepIds: ['adventure-begins'] };

function request(path: string, method = 'GET', value?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${origin}/api/v1/adventure/${path}`, {
    method, headers: { origin, 'content-type': 'application/json', ...headers },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('APP_URL', origin);
  mocks.session.mockResolvedValue({ call: mocks.call });
});
afterEach(() => vi.unstubAllEnvs());

const reads = [
  ['access', (req: NextRequest) => access(req)],
  ['members', (req: NextRequest) => members(req)],
  ['progress/hello-explorer', (req: NextRequest) => progress(req, missionContext)],
] as const;

describe('adventure HTTP authorization and own-account progress', () => {
  it.each(reads)('requires a session for GET %s', async (path, handler) => {
    mocks.session.mockRejectedValue(new DomainError(401, 'unauthenticated', 'Inicia sesión para continuar.'));
    const response = await handler(request(path));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it.each([
    ['members/user', (req: NextRequest) => setAccess(req, memberContext), 'PUT', { enabled: true }],
    ['progress/hello-explorer', (req: NextRequest) => setProgress(req, missionContext), 'PUT', { stepId: 'adventure-begins', completed: true }],
    ['progress/hello-explorer', (req: NextRequest) => resetProgress(req, missionContext), 'DELETE', {}],
  ] as const)('rejects foreign or missing origins for mutation %s', async (path, handler, method, payload) => {
    const attempts: Record<string, string>[] = [{ origin: 'https://foreign.example' }, { 'sec-fetch-site': 'cross-site' }, { origin: '' }];
    for (const headers of attempts) {
      const response = await handler(request(path, method, payload, headers));
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe('invalid_origin');
    }
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it('requires a session for every mutation even with a trusted origin', async () => {
    mocks.session.mockRejectedValue(new DomainError(401, 'unauthenticated', 'Inicia sesión para continuar.'));
    const responses = await Promise.all([
      setAccess(request(`members/${userId}`, 'PUT', { enabled: true }), memberContext),
      setProgress(request('progress/hello-explorer', 'PUT', { stepId: 'adventure-begins', completed: true }), missionContext),
      resetProgress(request('progress/hello-explorer', 'DELETE', {}), missionContext),
    ]);
    for (const response of responses) expect(response.status).toBe(401);
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it('returns visibility without granting access and enforces the server-render guard', async () => {
    mocks.call.mockResolvedValue({ allowed: false });
    const response = await access(request('access'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ data: { allowed: false } });
    expect(mocks.call).toHaveBeenCalledWith('api_adventure_access', {});
    await expect(requireAdventureAccess()).rejects.toMatchObject({ status: 403, code: 'adventure_forbidden' });
    mocks.call.mockResolvedValue({ allowed: true });
    await expect(requireAdventureAccess()).resolves.toEqual({ allowed: true });
  });

  it('forwards admin-only member operations to session RPCs', async () => {
    const list = [{ id: userId, name: 'QA Explorer', email: 'explorer@example.invalid', role: 'student', active: true, enabled: false }];
    mocks.call.mockResolvedValueOnce(list).mockResolvedValueOnce({ userId, enabled: true });
    expect(await (await members(request('members'))).json()).toEqual({ data: list });
    const result = await setAccess(request(`members/${userId}`, 'PUT', { enabled: true }), memberContext);
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(await result.json()).toEqual({ data: { userId, enabled: true } });
    expect(mocks.call.mock.calls).toEqual([
      ['api_adventure_members', {}], ['api_set_adventure_access', { p_user_id: userId, p_enabled: true }],
    ]);
  });

  it('keeps the backend denial and unknown-member status without leaking data', async () => {
    for (const [status, code] of [[403, 'forbidden'], [404, 'member_not_found']] as const) {
      mocks.call.mockRejectedValueOnce(new DomainError(status, code, 'Solicitud rechazada.'));
      const response = await setAccess(request(`members/${userId}`, 'PUT', { enabled: false }), memberContext);
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: { code, message: 'Solicitud rechazada.' } });
    }
    mocks.call.mockRejectedValueOnce(new DomainError(403, 'adventure_forbidden', 'No tienes acceso.'));
    const denied = await progress(request('progress/hello-explorer'), missionContext);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe('adventure_forbidden');
  });

  it('reads, marks and resets only the session account through canonical mission parameters', async () => {
    const empty = { missionId: 'hello-explorer', completedStepIds: [] };
    mocks.call.mockResolvedValueOnce(completed).mockResolvedValueOnce(completed).mockResolvedValueOnce(empty);
    const read = await progress(request('progress/hello-explorer'), missionContext);
    const write = await setProgress(request('progress/hello-explorer', 'PUT', { stepId: 'adventure-begins', completed: true }), missionContext);
    const reset = await resetProgress(request('progress/hello-explorer', 'DELETE', {}), missionContext);
    for (const response of [read, write, reset]) {
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('private, no-store');
    }
    expect(await read.json()).toEqual({ data: completed });
    expect(await write.json()).toEqual({ data: completed });
    expect(await reset.json()).toEqual({ data: empty });
    expect(mocks.call.mock.calls).toEqual([
      ['api_adventure_progress', { p_mission_id: 'hello-explorer' }],
      ['api_set_adventure_progress', { p_mission_id: 'hello-explorer', p_step_id: 'adventure-begins', p_completed: true }],
      ['api_reset_adventure_progress', { p_mission_id: 'hello-explorer' }],
    ]);
  });

  it('validates UUID and mission route parameters before RPC execution', async () => {
    const invalidUser = await setAccess(request('members/no-uuid', 'PUT', { enabled: true }), { params: Promise.resolve({ userId: 'no-uuid' }) });
    expect(invalidUser.status).toBe(422);
    expect((await invalidUser.json()).error.fieldErrors).toHaveProperty('userId');
    const invalidMission = await progress(request('progress/unknown'), { params: Promise.resolve({ missionId: 'unknown' }) });
    expect(invalidMission.status).toBe(422);
    expect((await invalidMission.json()).error.fieldErrors).toHaveProperty('missionId');
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it('rejects foreign steps, non-booleans, impersonation fields and reset payloads', async () => {
    for (const value of [{ stepId: 'invented', completed: true }, { stepId: 'adventure-begins', completed: 'true' }, { stepId: 'adventure-begins', completed: true, userId }]) {
      expect((await setProgress(request('progress/hello-explorer', 'PUT', value), missionContext)).status).toBe(422);
    }
    expect((await setProgress(request('progress/my-world', 'PUT', { stepId: 'adventure-begins', completed: true }), { params: Promise.resolve({ missionId: 'my-world' }) })).status).toBe(422);
    for (const value of [{ enabled: 'true' }, { enabled: true, role: 'admin' }, { enabled: null }, {}]) {
      expect((await setAccess(request(`members/${userId}`, 'PUT', value), memberContext)).status).toBe(422);
    }
    expect((await resetProgress(request('progress/hello-explorer', 'DELETE', { userId }), missionContext)).status).toBe(422);
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it('rejects malformed or non-JSON writes without executing a mutation', async () => {
    const malformed = new NextRequest(`${origin}/api/v1/adventure/members/${userId}`, { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: '{' });
    const invalid = await setAccess(malformed, memberContext);
    expect(invalid.status).toBe(422);
    expect((await invalid.json()).error.code).toBe('invalid_json');
    const contentType = await resetProgress(request('progress/hello-explorer', 'DELETE', {}, { 'content-type': 'text/plain' }), missionContext);
    expect(contentType.status).toBe(422);
    expect((await contentType.json()).error.code).toBe('invalid_content_type');
    expect(mocks.call).not.toHaveBeenCalled();
  });

  it('validates returned progress against canonical and unique mission steps', () => {
    expect(adventureProgressSchema.safeParse(completed).success).toBe(true);
    expect(adventureProgressSchema.safeParse({ ...completed, completedStepIds: ['adventure-begins', 'adventure-begins'] }).success).toBe(false);
    expect(adventureProgressSchema.safeParse({ ...completed, missionId: 'my-world' }).success).toBe(false);
  });
});

it('documents every adventure operation, cookie session and mutation origin', () => {
  const document = YAML.parse(readFileSync(new URL('../docs/openapi.yaml', import.meta.url), 'utf8'));
  for (const [path, methods] of [
    ['/api/v1/adventure/access', ['get']], ['/api/v1/adventure/members', ['get']],
    ['/api/v1/adventure/members/{userId}', ['put']], ['/api/v1/adventure/progress/{missionId}', ['get', 'put', 'delete']],
  ] as const) {
    for (const method of methods) {
      const operation = document.paths[path][method];
      for (const code of ['200', '401', '403']) expect(operation.responses[code]).toBeDefined();
      expect(operation.security).not.toEqual([]);
      if (method !== 'get') expect(operation.parameters).toContainEqual({ $ref: '#/components/parameters/Origin' });
    }
  }
});
