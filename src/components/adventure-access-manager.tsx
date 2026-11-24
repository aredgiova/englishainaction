"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdventureMember } from "@/lib/adventure-access-contracts";
import { api, messageFrom } from "./api";
import { Notice } from "./ui";
import styles from "./adventure-catalog.module.css";

export function AdventureAccessManager({ initialMembers }: { initialMembers: AdventureMember[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = members.filter(member => (role === "all" || member.role === role) && `${member.name} ${member.email}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  async function toggle(member: AdventureMember) {
    if (busy) return;
    setBusy(member.id); setError(""); setNotice("");
    try {
      const result = await api<{ userId: string; enabled: boolean }>(`/adventure/members/${member.id}`, "PUT", { enabled: !member.enabled });
      setMembers(previous => previous.map(item => item.id === result.userId ? { ...item, enabled: result.enabled } : item));
      setNotice(`${result.enabled ? "Acceso habilitado" : "Acceso retirado"} para ${member.name || member.email}. Su avance se conserva.`);
      router.refresh();
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusy(null); }
  }
  return <section id="acceso-aventura" className={styles.access} aria-labelledby="adventure-access-heading">
    <h2 id="adventure-access-heading">Quién puede entrar</h2>
    <p>Controla el acceso a las dos misiones de English Learning Adventure.</p>
    <div className={styles.filters}><label>Buscar persona<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o correo" /></label><label>Rol<select value={role} onChange={event => setRole(event.target.value)}><option value="all">Todos</option><option value="teacher">Docentes</option><option value="student">Estudiantes</option></select></label></div>
    {error && <Notice>{error}</Notice>}{notice && <Notice tone="success">{notice}</Notice>}
    <p className={styles.count}>{filtered.length} {filtered.length === 1 ? "persona" : "personas"} · Las cuentas inactivas no pueden entrar.</p>
    {filtered.length ? <ul className={styles.memberList}>{filtered.map(member => <li className={styles.member} key={member.id}>
      <div className={styles.person}><strong>{member.name || member.email}</strong><span>{member.email}</span><span>{member.role === "teacher" ? "Docente" : "Estudiante"}{!member.active ? " · Cuenta inactiva" : ""}</span></div>
      <span className={`${styles.status} ${!member.enabled || !member.active ? styles.hidden : ""}`}>{!member.active ? "Inactiva" : member.enabled ? "Con acceso" : "Sin acceso"}</span>
      <button className={styles.toggle} disabled={busy !== null || !member.active} aria-label={`${member.enabled ? "Retirar acceso" : "Permitir acceso"} a ${member.email}`} onClick={() => toggle(member)}>{busy === member.id ? "Guardando…" : member.enabled ? "Retirar acceso" : "Permitir acceso"}</button>
    </li>)}</ul> : <p className={styles.empty}>No hay personas que coincidan con tu búsqueda.</p>}
  </section>;
}
