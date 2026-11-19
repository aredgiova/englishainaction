"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BookOpen, LogOut, Users, Library } from "lucide-react";
import type { Profile } from "@/lib/contracts";
import { roleHome } from "@/lib/navigation";
import { SessionRecovery } from "./session-recovery";
import { api, messageFrom } from "./api";
import { Brand, roleNames } from "./ui";

export function AppShell({ me, children }: { me: Profile; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const home = roleHome(me.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const Icon = me.role === "admin" ? Users : me.role === "teacher" ? Library : BookOpen;
  async function logout() {
    if (!window.dispatchEvent(new Event("eia:before-logout", { cancelable: true }))) return;
    setBusy(true); setError("");
    try {
      await api("/auth/logout", "POST");
      try {
        const prefixes = [`eia-draft:${me.id}:`, `eia-attempt:${me.id}:`];
        for (let index = sessionStorage.length - 1; index >= 0; index--) {
          const key = sessionStorage.key(index);
          if (key && prefixes.some(prefix => key.startsWith(prefix))) sessionStorage.removeItem(key);
        }
      } catch { /* Storage may be disabled; the session is already closed. */ }
      router.replace("/ingresar"); router.refresh();
    }
    catch (e) { setError(messageFrom(e)); setBusy(false); }
  }
  return <div className="app-shell"><a className="skip-link" href="#main-content">Saltar al contenido</a><aside className="sidebar"><Brand light /><div className="workspace-label">{roleNames[me.role]}</div><nav aria-label="Navegación principal"><Link className="nav-link current" href={home} aria-current={pathname === home ? "page" : undefined}><Icon size={19} />{me.role === "admin" ? "Administración" : me.role === "teacher" ? "Autoría de cursos" : "Mi campus"}</Link></nav><div className="sidebar-bottom"><div className="user-avatar" aria-hidden="true">{me.name.slice(0, 1).toUpperCase()}</div><div className="user-details"><strong>{me.name}</strong><span>{me.email}</span></div><button className="logout" onClick={logout} disabled={busy} title="Cerrar sesión" aria-label={busy ? "Cerrando sesión" : "Cerrar sesión"}><LogOut size={19} /></button>{error && <p className="sidebar-error" role="alert">{error}</p>}</div></aside><div className="app-body"><header className="topbar"><span>Tu academia de inglés</span><span className="role-tag">{roleNames[me.role]}</span></header><main id="main-content" className="main-content"><SessionRecovery me={me} />{children}</main><footer className="app-footer">English in Action<span>Aprendizaje en práctica</span></footer></div></div>;
}
