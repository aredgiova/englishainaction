import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { loginSchema } from '@/lib/contracts';
import { createSessionClient } from '@/lib/supabase/server';
import { DomainError } from '@/lib/errors';
import { getMe } from '@/lib/services';
export const POST = (request: NextRequest) => handle(request, async () => {
  const input = await body(request, loginSchema);
  const client = await createSessionClient();
  const { error } = await client.auth.signInWithPassword(input);
  if (error) throw new DomainError(401, 'invalid_credentials', 'El correo o la contraseña no son correctos.');
  try { return dataResponse(await getMe()); }
  catch (error) { await client.auth.signOut(); throw error; }
}, false);
