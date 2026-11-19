import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DomainError } from './errors';
import { appUrl } from './env';
import { sessionRepository } from './repository';

export function assertTrustedOrigin(request: Request) {
  if (request.headers.get('origin') !== appUrl() || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new DomainError(403, 'invalid_origin', 'El origen de la solicitud no está permitido.');
  }
}

export async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new DomainError(422, 'invalid_content_type', 'Envía un cuerpo JSON.');
  }
  const maximum = 524288;
  const tooLarge = () => new DomainError(422, 'body_too_large', 'El documento supera el límite de 512 KB.');
  if (Number(request.headers.get('content-length')) > maximum) throw tooLarge();
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let raw = '';
  if (reader) {
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > maximum) { await reader.cancel(); throw tooLarge(); }
        raw += decoder.decode(part.value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
  }
  let json: unknown;
  try { json = JSON.parse(raw); } catch { throw new DomainError(422, 'invalid_json', 'El cuerpo debe ser JSON válido.'); }
  return schema.parse(json);
}

export function dataResponse(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) (fieldErrors[issue.path.join('.') || 'body'] ??= []).push(issue.message);
    error = new DomainError(422, 'validation_error', 'Revisa los datos indicados.', fieldErrors);
  }
  const known = error instanceof DomainError;
  if (!known) console.error('Unhandled request error', error instanceof Error ? error.name : typeof error);
  const e = error instanceof DomainError ? error : new DomainError(500, 'internal_error', 'No pudimos completar la operación.');
  return NextResponse.json({ error: { code: e.code, message: e.message, ...(e.fieldErrors ? { fieldErrors: e.fieldErrors } : {}) } }, { status: e.status, headers: { 'Cache-Control': 'private, no-store' } });
}

export function handle(request: NextRequest, action: () => Promise<Response>, authenticated = true) {
  return (async () => {
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) assertTrustedOrigin(request);
      if (authenticated) await sessionRepository();
      return await action();
    } catch (error) { return errorResponse(error); }
  })();
}
