import { NextResponse, type NextRequest } from 'next/server';
import { createSessionClient } from '@/lib/supabase/server';
import { appUrl } from '@/lib/env';
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const target = new URL('/ingresar?error=invalid_link', appUrl());
  if (token_hash && (type === 'invite' || type === 'recovery')) {
    const { error } = await (await createSessionClient()).auth.verifyOtp({ token_hash, type });
    if (!error) { target.pathname = '/definir-clave'; target.search = ''; }
  }
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
