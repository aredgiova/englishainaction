"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send, UserPlus } from "lucide-react";
import type { CourseSummary } from "@/lib/contracts";
import { api, messageFrom } from "./api";
import { Notice } from "./ui";

export function CreateCourse() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try { const result = await api<{ courseId: string }>("/courses", "POST", { title: form.get("title"), level: form.get("level"), audience: form.get("audience") }); router.push(`/cursos/${result.courseId}/editar`); router.refresh(); }
    catch (e) { setError(messageFrom(e)); setBusy(false); }
  }
  return <section className="create-course">{!open ? <button className="button" onClick={() => setOpen(true)}><Plus size={18} />Crear un curso</button> : <div className="form-panel"><h2>Un nuevo comienzo</h2><p className="muted">Define lo esencial. Podrás completar el material en el borrador.</p>{error && <Notice>{error}</Notice>}<form onSubmit={submit}><fieldset disabled={busy}><div className="form-grid"><label className="span-two">Título del curso<input name="title" maxLength={200} placeholder="Por ejemplo: First Conversations" required autoFocus /></label><label>Nivel MCER<select name="level" defaultValue="A1">{["A1", "A2", "B1", "B2", "C1", "C2"].map(level => <option key={level}>{level}</option>)}</select></label><label>Público<select name="audience" defaultValue="university"><option value="school">Escolar</option><option value="university">Universitario</option><option value="professional">Profesional</option></select></label></div><div className="form-actions"><button className="button" type="submit">{busy ? "Creando…" : "Crear borrador"}</button><button className="button ghost" type="button" onClick={() => setOpen(false)}>Cancelar</button></div></fieldset></form></div>}</section>;
}

export function Administration({ courses }: { courses: CourseSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"invite" | "enroll" | null>(null);
  const [inviteError, setInviteError] = useState(""); const [inviteSuccess, setInviteSuccess] = useState("");
  const [enrollError, setEnrollError] = useState(""); const [enrollSuccess, setEnrollSuccess] = useState("");
  const published = courses.filter(course => course.published);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form); setBusy("invite"); setInviteError(""); setInviteSuccess("");
    try { await api("/admin/invitations", "POST", { name: fields.get("name"), email: fields.get("email"), role: fields.get("role") }); setInviteSuccess(`Invitación enviada a ${fields.get("email")}. La persona debe activar su cuenta desde el correo.`); form.reset(); }
    catch (e) { setInviteError(messageFrom(e)); } finally { setBusy(null); }
  }
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form); setBusy("enroll"); setEnrollError(""); setEnrollSuccess("");
    try { await api(`/courses/${fields.get("courseId")}/enrollments`, "POST", { studentEmail: fields.get("studentEmail") }); setEnrollSuccess(`Matrícula confirmada para ${fields.get("studentEmail")}.`); form.reset(); router.refresh(); }
    catch (e) { setEnrollError(messageFrom(e)); } finally { setBusy(null); }
  }
  return <div className="admin-grid"><section className="form-panel"><div className="section-heading"><UserPlus size={22} /><h2>Invitar a la academia</h2></div><p className="muted">El correo permite activar la cuenta y definir una contraseña.</p>{inviteError && <Notice>{inviteError}</Notice>}{inviteSuccess && <Notice tone="success">{inviteSuccess}</Notice>}<form onSubmit={invite} className="form-stack"><fieldset disabled={busy !== null}><label>Nombre completo<input name="name" autoComplete="name" maxLength={120} required /></label><label>Correo electrónico<input name="email" type="email" autoComplete="email" maxLength={254} required /></label><label>Rol<select name="role"><option value="student">Estudiante</option><option value="teacher">Docente</option></select></label><button className="button" type="submit"><Send size={16} />{busy === "invite" ? "Enviando…" : "Enviar invitación"}</button></fieldset></form></section><section className="form-panel"><div className="section-heading"><Plus size={22} /><h2>Matricular a un estudiante</h2></div><p className="muted">La cuenta debe estar activa y el curso debe tener una publicación.</p>{enrollError && <Notice>{enrollError}</Notice>}{enrollSuccess && <Notice tone="success">{enrollSuccess}</Notice>}{published.length ? <form onSubmit={enroll} className="form-stack"><fieldset disabled={busy !== null}><label>Correo del estudiante<input name="studentEmail" type="email" maxLength={254} required /></label><label>Curso publicado<select name="courseId" required defaultValue=""><option value="" disabled>Selecciona un curso</option>{published.map(course => <option key={course.courseId} value={course.courseId}>{course.title} · {course.level}</option>)}</select></label><p className="field-help">Una matrícula da acceso a la versión vigente del curso.</p><button className="button" type="submit">{busy === "enroll" ? "Matriculando…" : "Confirmar matrícula"}</button></fieldset></form> : <div className="inline-empty"><p>Aún no hay cursos publicados.</p><span>Un docente debe publicar el primer curso para habilitar las matrículas.</span></div>}</section></div>;
}
