"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { Profile } from "@/lib/contracts";
import { api, messageFrom } from "../api";
import { SessionRecovery } from "../session-recovery";
import styles from "./adventure.module.css";

export function AdventureSession({ me }: { me: Profile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true); setError("");
    try {
      await api("/auth/logout", "POST");
      try {
        for (let index = sessionStorage.length - 1; index >= 0; index--) {
          const key = sessionStorage.key(index);
          if (key?.startsWith(`eia-draft:${me.id}:`) || key?.startsWith(`eia-attempt:${me.id}:`)) sessionStorage.removeItem(key);
        }
      } catch { /* The session is closed even when storage is unavailable. */ }
      router.replace("/ingresar"); router.refresh();
    } catch (cause) { setError(messageFrom(cause)); setBusy(false); }
  }
  return <div className={styles.session}>
    <SessionRecovery me={me} />
    <span>{me.name.split(" ")[0]}</span>
    <button type="button" onClick={logout} disabled={busy} aria-label="Cerrar sesión"><LogOut size={16} />{busy ? "Saliendo…" : "Salir"}</button>
    {error && <p role="alert">{error}</p>}
  </div>;
}
