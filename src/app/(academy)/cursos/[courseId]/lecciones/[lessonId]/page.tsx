import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { getLesson, getOutline, getMe } from "@/lib/services";
import { roleHome } from "@/lib/navigation";
import type { Lesson, Outline, Profile } from "@/lib/contracts";
import { pageProblem } from "@/components/page-problem";
import { LessonPractice } from "@/components/lesson-practice";
import { BackLink } from "@/components/ui";

export default async function LessonPage({ params }: { params: Promise<{ courseId: string; lessonId: string }> }) {
  const { courseId, lessonId } = await params;
  let me: Profile;
  try { me = await getMe(); }
  catch (error) { return pageProblem(error); }
  if (me.role !== "student") redirect(roleHome(me.role));
  let lesson: Lesson; let outline: Outline;
  try { [lesson, outline] = await Promise.all([getLesson(courseId, lessonId), getOutline(courseId)]); }
  catch (error) { return pageProblem(error); }
  const allLessons = outline.units.flatMap(unit => unit.lessons);
  return <><BackLink href={`/cursos/${courseId}`}>{outline.title}</BackLink><div className="lesson-layout"><aside className="lesson-navigation" aria-label="Lecciones del curso"><h2>Tu recorrido</h2>{outline.units.map(unit => <div key={unit.id}><h3>{unit.title}</h3><ol>{unit.lessons.map(item => <li key={item.id}><Link className={item.id === lessonId ? "active" : ""} aria-current={item.id === lessonId ? "page" : undefined} href={`/cursos/${courseId}/lecciones/${item.id}`}>{item.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}<span lang="en">{item.title}</span></Link></li>)}</ol></div>)}</aside><article className="lesson-content"><div className="lesson-title"><span className="lesson-position">Lección {allLessons.findIndex(item => item.id === lessonId) + 1} de {allLessons.length}</span><h1 lang="en">{lesson.title}</h1></div><section className="lesson-objective"><h2>Tu objetivo</h2><p lang="en">{lesson.objective}</p></section><section className="lesson-reading"><h2>Lee y observa</h2>{lesson.blocks.map(block => <div className="reading-block" lang="en" key={block.id}>{block.text}</div>)}</section><LessonPractice key={`${me.id}:${lesson.lessonVersionId}`} lesson={lesson} learnerId={me.id} /></article></div></>;
}
