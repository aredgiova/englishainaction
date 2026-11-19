import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/v1/auth/recover/route';
const mocks = vi.hoisted(() => ({ recover: vi.fn(), session: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('../src/lib/repository', () => ({ sessionRepository: mocks.session }));
vi.mock('../src/lib/supabase/server', () => ({ createSessionClient: async () => ({ auth: { resetPasswordForEmail: mocks.recover } }) }));
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('APP_URL', 'http://127.0.0.1:3000'); });
function request() { return new NextRequest('http://127.0.0.1:3000/api/v1/auth/recover', { method: 'POST', headers: { origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify({ email: 'someone@example.test' }) }); }
it('uses the same generic recovery response for existing and missing accounts', async () => {
  mocks.recover.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: 'user_not_found' } });
  const existing = await POST(request()); const missing = await POST(request());
  expect(existing.status).toBe(200); expect(missing.status).toBe(200);
  expect(await existing.json()).toEqual(await missing.json());
  expect(mocks.session).not.toHaveBeenCalled();
});
it('reports operational recovery failures so users can retry', async () => {
  mocks.recover.mockResolvedValue({ error: { status: 503, code: 'unexpected_failure' } });
  const response = await POST(request());
  expect(response.status).toBe(502); expect((await response.json()).error.code).toBe('recovery_unavailable');
});
