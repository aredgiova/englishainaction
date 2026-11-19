export class ClientApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>,
    public status?: number,
  ) {
    super(message);
    this.name = "ClientApiError";
  }
}

export async function api<T>(path: string, method = "GET", body?: unknown, idempotencyKey?: string): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload: { data?: T; error?: { code?: string; message?: string; fieldErrors?: Record<string, string[]> } } = await response.json().catch(() => ({}));
  if (!response.ok) {
    const expired = response.status === 401 && !path.startsWith("/auth/");
    if (expired && typeof window !== "undefined") window.dispatchEvent(new Event("eia:session-expired"));
    throw new ClientApiError(payload.error?.code ?? "request_failed", expired ? "Tu sesión caducó. Vuelve a ingresar para continuar; tu trabajo permanece en esta página." : payload.error?.message ?? "No se pudo completar la solicitud. Inténtalo de nuevo.", payload.error?.fieldErrors, response.status);
  }
  return payload.data as T;
}

export function messageFrom(error: unknown): string {
  if (error instanceof TypeError) return "No pudimos conectar. Revisa tu conexión y vuelve a intentarlo; conservaremos tus respuestas.";
  return error instanceof Error ? error.message : "Ocurrió un problema. Inténtalo de nuevo.";
}
