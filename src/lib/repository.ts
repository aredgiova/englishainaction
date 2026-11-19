import 'server-only';
import { createSessionClient } from './supabase/server';
import { DomainError, fromDatabaseError } from './errors';

export async function sessionRepository() {
  const client = await createSessionClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new DomainError(401, 'unauthenticated', 'Inicia sesión para continuar.');
  return {
    client, user: data.user,
    async call<T>(operation: string, args: Record<string, unknown> = {}): Promise<T> {
      const result = await client.rpc(operation, args);
      if (result.error) throw fromDatabaseError(result.error);
      return result.data as T;
    }
  };
}
