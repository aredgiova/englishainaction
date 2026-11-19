"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Profile } from "@/lib/contracts";
import { api, messageFrom } from "./api";
import { Notice } from "./ui";
import styles from "./session-recovery.module.css";

export function SessionRecovery({ me }: { me: Profile }) {
  const [expired, setExpired] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function showRecovery() {
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setExpired(true);
      setRecovered(false);
    }
    window.addEventListener("eia:session-expired", showRecovery);
    return () => window.removeEventListener("eia:session-expired", showRecovery);
  }, []);

  useEffect(() => {
    if (expired) {
      passwordRef.current?.focus();
      passwordRef.current?.scrollIntoView({ block: "center" });
    }
  }, [expired]);

  async function restore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    setBusy(true); setError("");
    try {
      const profile = await api<Profile>("/auth/login", "POST", { email: me.email, password });
      if (profile.id !== me.id || profile.role !== me.role) {
        await api("/auth/logout", "POST");
        setError("La cuenta o sus permisos cambiaron. Guarda una copia de tu trabajo y vuelve a abrir el acceso.");
        return;
      }
      form.reset();
      setExpired(false); setRecovered(true);
      // Keep the mounted editor and pending attempt intact; retry is a separate action.
      previousFocus.current?.focus();
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(false); }
  }

  if (!expired) return recovered ? <Notice tone="success">Sesión restablecida. Vuelve a guardar o entregar para continuar.</Notice> : null;
  return <section className={styles.recovery} aria-labelledby="session-title">
    <h2 id="session-title">Tu sesión caducó</h2>
    <p>Tu trabajo sigue aquí. Ingresa con la misma cuenta y vuelve a intentar la acción.</p>
    {error && <Notice>{error}</Notice>}
    <form onSubmit={restore}>
      <fieldset disabled={busy} className={styles.fields}>
        <label>Correo de tu cuenta<input type="email" name="email" autoComplete="username" value={me.email} readOnly /></label>
        <label>Contraseña para continuar<input ref={passwordRef} type="password" name="password" autoComplete="current-password" required maxLength={128} /></label>
        <button className="button" type="submit">{busy ? "Restableciendo sesión…" : "Restablecer sesión"}</button>
      </fieldset>
    </form>
  </section>;
}
