import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { redirect } from "next/navigation";
import { getMe, getOutline } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import { pageProblem } from "@/components/page-problem";
import { BackLink, CourseMeta, Progress } from "@/components/ui";
import type { Outline, Profile } from "@/lib/contracts";

export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "student") redirect(roleHome(me.role));
  let course: Outline;
  try { course = await getOutline(courseId); }
  catch (error) { return pageProblem(error); }
    return <><BackLink href="/campus">Mi campus</BackLink><div className="course-heading"><div><h1>{course.title}</h1><CourseMeta course={course} /></div><Progress {...course.courseProgress} /></div><section className="outline"><h2>Tu recorrido</h2>{course.units.map((unit, index) => <section className="unit-outline" key={unit.id}><h3><span>Unidad {index + 1}</span>{unit.title}</h3><ol>{unit.lessons.map(lesson => <li key={lesson.id}><Link href={`/cursos/${courseId}/lecciones/${lesson.id}`} className="lesson-row">{lesson.completed ? <CheckCircle2 size={22} className="success-ink" /> : <Circle size={22} className="muted" />}<span><strong lang="en">{lesson.title}</strong><small>{lesson.completed ? "Completada · Puedes volver a practicar" : lesson.id === course.courseProgress.nextLessonId ? "Tu siguiente lección" : "Pendiente"}</small></span><ArrowRight size={19} /></Link></li>)}</ol></section>)}</section><p className="learning-note">Tu avance se guarda cuando entregas una práctica válida, aunque tengas errores.</p></>;
}
