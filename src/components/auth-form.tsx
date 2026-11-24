"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { api, messageFrom } from "./api";
import { Notice } from "./ui";
import type { Profile } from "@/lib/contracts";
import { roleHome } from "@/lib/navigation";
import styles from "./auth.module.css";

type AuthMode = "login" | "recover" | "password";
export function AuthForm({ mode, configured, invalidLink = false, sessionExpired = false }: { mode: AuthMode; configured: boolean; invalidLink?: boolean; sessionExpired?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(invalidLink ? "El enlace no es válido o ha caducado. Solicita un nuevo correo de recuperación." : sessionExpired ? "Tu sesión caducó. Ingresa de nuevo para retomar tu actividad." : "");
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const title = mode === "login" ? "Tu aventura continúa." : mode === "recover" ? "Recupera tu acceso" : "Define tu contraseña";
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
  return <div className={styles.formWrap}>
    <h1>{title}</h1>
    <p className={styles.description}>{mode === "login" ? "Ingresa a tu academia." : mode === "recover" ? "Te enviaremos un enlace para volver a entrar." : "Usa al menos 12 caracteres."}</p>
    {!configured && <Notice tone="info"><strong>Acceso temporalmente no disponible.</strong><p>Contacta con la administración de la academia.</p></Notice>}
    {error && <Notice>{error}</Notice>}
    {done ? <div className={styles.success} role="status">
      <CheckCircle2 size={34} aria-hidden="true" />
      <h2>Revisa tu correo</h2>
      <p>Si la cuenta existe, recibirás un enlace para recuperar el acceso.</p>
      <Link className={styles.submit} href="/ingresar">Volver al acceso<ArrowRight size={18} aria-hidden="true" /></Link>
    </div> : <form onSubmit={submit} className={styles.form} aria-busy={busy}>
      <fieldset disabled={busy || !configured}>
        {mode !== "password" && <label>Correo electrónico<input name="email" type="email" autoComplete={mode === "login" ? "username" : "email"} placeholder="tu@correo.com" autoCapitalize="none" spellCheck={false} required maxLength={254} /></label>}
        {mode !== "recover" && <label>{mode === "password" ? "Nueva contraseña" : "Contraseña"}
          <span className={styles.passwordField}>
            <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "password" ? "new-password" : "current-password"} minLength={mode === "password" ? 12 : 1} maxLength={128} required />
            <button className={styles.visibility} type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>{showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}</button>
          </span>
        </label>}
        {mode === "password" && <label>Confirma la contraseña<input name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required /></label>}
        {mode === "login" && <Link className={styles.formLink} href="/recuperar-clave">Olvidé mi contraseña</Link>}
        <button className={styles.submit} type="submit">{busy ? "Un momento…" : mode === "login" ? "Ingresar a la academia" : mode === "recover" ? "Enviar enlace" : "Guardar y continuar"}{!busy && <ArrowRight size={18} aria-hidden="true" />}</button>
      </fieldset>
    </form>}
    {mode === "login" ? <p className={styles.footnote}>¿Aún no tienes cuenta? Pide tu invitación a la administración.</p> : !done && <Link className={styles.back} href="/ingresar"><ArrowLeft size={16} aria-hidden="true" />Volver al acceso</Link>}
  </div>;
}
