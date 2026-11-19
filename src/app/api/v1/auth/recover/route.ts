import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { recoverySchema } from '@/lib/contracts';
import { createSessionClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env';
import { DomainError } from '@/lib/errors';
export const POST = (request: NextRequest) => handle(request, async () => {
  const input = await body(request, recoverySchema);
  const { error } = await (await createSessionClient()).auth.resetPasswordForEmail(input.email, { redirectTo: `${appUrl()}/auth/confirm` });
  if (error && error.code !== 'user_not_found') throw new DomainError(502, 'recovery_unavailable', 'No se pudo procesar la recuperación. Espera unos minutos e inténtalo de nuevo.');
  return dataResponse({ message: 'Si la cuenta existe, recibirás un correo.' });
}, false);
