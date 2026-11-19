export class DomainError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'DomainError';
  }
}

export function fromDatabaseError(error: { message: string; code?: string }): DomainError {
  try {
    const detail: unknown = JSON.parse(error.message);
    if (detail && typeof detail === 'object' && 'status' in detail && 'code' in detail && 'message' in detail) {
      const e = detail as { status: number; code: string; message: string; fieldErrors?: Record<string, string[]> };
      if ([401, 403, 404, 409, 422].includes(e.status)) return new DomainError(e.status, e.code, e.message, e.fieldErrors);
    }
  } catch { /* PostgreSQL may return a non-domain error. */ }
  if (error.code === '23505') return new DomainError(409, 'conflict', 'La operación entra en conflicto con un registro existente.');
  console.error('Database operation failed', { code: error.code });
  return new DomainError(500, 'database_error', 'No pudimos completar la operación. Inténtalo de nuevo.');
}
