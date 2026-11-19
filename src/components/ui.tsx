import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { CourseSummary } from "@/lib/contracts";

export const audienceNames = { school: "Escolar", university: "Universitario", professional: "Profesional" };
export const roleNames = { admin: "Administración", teacher: "Docente", student: "Estudiante" };

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/panel" className={`brand ${light ? "brand-light" : ""}`} aria-label="English in Action, inicio"><span className="brand-symbol"><MessageCircle size={25} strokeWidth={1.8} /></span><span>English<span className="brand-second">in Action<span className="brand-dot">.</span></span></span></Link>;
}
export function Notice({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" | "info" }) {
  return <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}
export function Progress({ completed, total }: { completed: number; total: number }) {
  const percentage = total ? Math.round(completed / total * 100) : 0;
  return <div className="progress-block"><div className="progress-label"><span>{completed} de {total} lecciones</span><strong>{percentage} %</strong></div><progress value={completed} max={total || 1} aria-label={`${completed} de ${total} lecciones completadas`} /></div>;
}
export function BackLink({ href, children }: { href: string; children: ReactNode }) { return <Link className="back-link" href={href}><ArrowLeft size={16} />{children}</Link>; }
export function CourseMeta({ course }: { course: Pick<CourseSummary, "level" | "audience"> }) { return <span className="muted">Nivel {course.level}<span className="meta-divider">/</span>{audienceNames[course.audience]}</span>; }
