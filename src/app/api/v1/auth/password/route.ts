import { type NextRequest } from 'next/server';
import { handle, dataResponse, body } from '@/lib/http';
import { passwordSchema } from '@/lib/contracts';
import { createSessionClient } from '@/lib/supabase/server';
import { DomainError } from '@/lib/errors';
export const POST = (request: NextRequest) => handle(request, async () => {
  const input = await body(request, passwordSchema);
  const { error } = await (await createSessionClient()).auth.updateUser(input);
  if (error) throw new DomainError(422, 'password_rejected', 'No se pudo guardar esa contraseña. Usa otra de al menos 12 caracteres.');
  return dataResponse({ updated: true });
});
