import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { DomainError } from "@/lib/errors";

export function pageProblem(error: unknown) {
  if (error instanceof DomainError && error.status === 401) redirect("/ingresar?error=session_expired");
  const setup = error instanceof DomainError && error.code === "setup_required";
  const absent = error instanceof DomainError && error.status === 404;
  if (error instanceof DomainError && error.code === "adventure_forbidden") return <section className="problem-panel"><AlertCircle size={32} /><h1>Este curso no está habilitado para tu cuenta</h1><p>Solicita acceso a la administración de la academia.</p><Link className="button secondary" href="/panel">Volver al panel</Link></section>;
  return <section className="problem-panel"><AlertCircle size={32} /><h1>{setup ? "Conecta tu academia" : absent ? "Este contenido no está disponible" : "No pudimos abrir esta página"}</h1><p>{error instanceof DomainError ? error.message : "Inténtalo de nuevo en unos momentos."}</p>{setup && <div className="setup-steps"><p>Sigue el README del proyecto para iniciar Supabase y configurar <code>.env.local</code>.</p><code>pnpm db:start<br />pnpm demo:seed<br />pnpm dev</code></div>}<Link className="button secondary" href={setup ? "/ingresar" : "/panel"}>{setup ? "Ir al acceso" : "Volver al panel"}</Link></section>;
}
