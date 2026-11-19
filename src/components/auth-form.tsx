"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { api, messageFrom } from "./api";
import { Brand, Notice } from "./ui";
import type { Profile } from "@/lib/contracts";
import { roleHome } from "@/lib/navigation";

type AuthMode = "login" | "recover" | "password";
export function AuthForm({ mode, configured, invalidLink = false, sessionExpired = false }: { mode: AuthMode; configured: boolean; invalidLink?: boolean; sessionExpired?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(invalidLink ? "El enlace no es válido o ha caducado. Solicita un nuevo correo de recuperación." : sessionExpired ? "Tu sesión caducó. Ingresa de nuevo para retomar tu actividad." : "");
  const [done, setDone] = useState(false);
  const title = mode === "login" ? "Bienvenido a tu academia" : mode === "recover" ? "Recupera tu acceso" : "Define tu contraseña";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    if (mode === "password" && password !== fields.get("confirmPassword")) { setError("Las contraseñas no coinciden. Revisa ambos campos."); return; }
    setBusy(true);
    try {
      const response = await api<Profile>(`/auth/${mode}`, "POST", mode === "password" ? { password } : mode === "recover" ? { email: fields.get("email") } : { email: fields.get("email"), password });
      if (mode === "recover") setDone(true);
      else { const me = mode === "login" ? response : await api<Profile>("/me"); router.replace(roleHome(me.role)); router.refresh(); }
    } catch (e) { setError(messageFrom(e)); } finally { setBusy(false); }
  }
  return <div className="auth-shell"><aside className="auth-aside"><Brand light /><div className="auth-intro"><div className="auth-emblem" aria-hidden="true"><BookOpen size={46} strokeWidth={1.4} /></div><h2>El inglés se aprende<br />poniéndolo en práctica.</h2><p>Tu contenido, tus conversaciones y un siguiente paso claro.</p></div><span className="auth-aside-footer">English in Action · Academia</span></aside><main className="auth-main"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><h1>{title}</h1><p className="auth-description">{mode === "login" ? "Accede para continuar donde lo dejaste." : mode === "recover" ? "Te enviaremos un enlace para crear una nueva contraseña." : "Usa al menos 12 caracteres para proteger tu cuenta."}</p>{!configured && <Notice tone="info"><strong>Falta conectar Supabase.</strong><p>Sigue el README, configura <code>.env.local</code> y ejecuta <code>pnpm db:start</code>. Después reinicia la aplicación.</p></Notice>}{error && <Notice>{error}</Notice>}{done ? <div className="auth-success"><CheckCircle2 size={32} /><h2>Revisa tu correo</h2><p>Si la cuenta existe, recibirás un enlace para recuperar el acceso. En el entorno local, abre el buzón indicado en el README.</p><Link className="button" href="/ingresar">Volver al acceso</Link></div> : <form onSubmit={submit} className="form-stack"><fieldset disabled={busy || !configured}>{mode !== "password" && <label>Correo electrónico<input name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required maxLength={254} /></label>}{mode !== "recover" && <label>{mode === "password" ? "Nueva contraseña" : "Contraseña"}<input name="password" type="password" autoComplete={mode === "password" ? "new-password" : "current-password"} minLength={mode === "password" ? 12 : 1} maxLength={128} required /></label>}{mode === "password" && <label>Confirma la contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>}{mode === "login" && <Link className="form-link" href="/recuperar-clave">Olvidé mi contraseña</Link>}<button className="button auth-submit" type="submit">{busy ? "Un momento…" : mode === "login" ? "Ingresar a la academia" : mode === "recover" ? "Enviar enlace" : "Guardar y continuar"}{!busy && <ArrowRight size={18} />}</button></fieldset></form>}{mode === "login" ? <p className="auth-footnote">El acceso es por invitación. Si aún no tienes cuenta, contacta con la administración.</p> : !done && <Link className="back-link" href="/ingresar">Volver al acceso</Link>}</div></main></div>;
}
