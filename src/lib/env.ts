import { DomainError } from './errors';

export function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new DomainError(503, 'setup_required', 'Configura Supabase local siguiendo el README y reinicia el servicio.');
  return { url, key };
}

export function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new DomainError(503, 'setup_required', 'Falta configurar APP_URL.');
  return new URL(value).origin;
}
