import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { DomainError } from '@/lib/errors';

export function createAdminClient() {
  const { url } = publicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new DomainError(503, 'setup_required', 'Falta configurar la clave de administración del servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
