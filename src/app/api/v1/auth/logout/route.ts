import { type NextRequest } from 'next/server';
import { handle, dataResponse } from '@/lib/http';
import { createSessionClient } from '@/lib/supabase/server';
import { DomainError } from '@/lib/errors';
export const POST = (request: NextRequest) => handle(request, async () => {
  const { error } = await (await createSessionClient()).auth.signOut({ scope: 'local' });
  if (error) throw new DomainError(502, 'logout_failed', 'No se pudo cerrar la sesión.');
  return dataResponse({ signedOut: true });
});
