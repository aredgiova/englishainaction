import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, RotateCcw } from "lucide-react";
import type { CourseSummary, Outline } from "@/lib/contracts";
import { CourseMeta, Progress } from "./ui";

function studentAction(course: CourseSummary) {
  const progress = course.progress;
  if (!progress) return { label: "Ver curso", href: `/cursos/${course.courseId}`, completed: false };
  if (progress.nextLessonId) return {
    label: progress.completed === 0 ? "Comenzar" : "Continuar",
    href: `/cursos/${course.courseId}/lecciones/${progress.nextLessonId}`,
    completed: false,
  };
  const completed = progress.total > 0 && progress.completed >= progress.total;
  return { label: completed ? "Repasar" : "Ver curso", href: `/cursos/${course.courseId}`, completed };
}

export function NextLesson({ outline }: { outline: Outline }) {
  const nextId = outline.courseProgress.nextLessonId;
  const nextLesson = outline.units.flatMap(unit => unit.lessons).find(lesson => lesson.id === nextId);
  if (!nextLesson) return null;
  const isNew = outline.courseProgress.completed === 0;
  return (
    <section className="campus-next" aria-labelledby="next-lesson-heading">
      <div className="campus-next-content">
        <h2 id="next-lesson-heading">Continuar mi lección</h2>
        <p className="campus-next-course" lang="en">{outline.title}</p>
        <h3 lang="en">{nextLesson.title}</h3>
        <p className="muted">{isNew ? "Tu primera lección de este curso te espera." : "Retoma la siguiente lección pendiente de tu recorrido."}</p>
      </div>
      <div className="campus-next-action">
        <Progress {...outline.courseProgress} />
        <Link className="button" href={`/cursos/${outline.courseId}/lecciones/${nextLesson.id}`}>
          {isNew ? "Comenzar" : "Continuar mi lección"}<ArrowRight size={18} />
        </Link>
        <Link className="campus-outline-link" href={`/cursos/${outline.courseId}`}>Ver todas las lecciones</Link>
      </div>
    </section>
  );
}

export function StudentCourses({ courses }: { courses: CourseSummary[] }) {
  return (
    <section className="courses-section" id="mis-cursos">
      <div className="section-title"><h2>Mis cursos</h2><span className="count-label">{courses.length} {courses.length === 1 ? "curso" : "cursos"}</span></div>
      {courses.length ? (
        <div className="course-list">
          {courses.map(course => {
            const action = studentAction(course);
            return (
              <article className="course-row campus-course-row" key={course.courseId}>
                <div className="course-level" aria-label={`Nivel ${course.level}`}>{course.level}</div>
                <div className="course-main">
                  <h3 lang="en">{course.title}</h3><CourseMeta course={course} />
                  {action.completed && <span className="badge badge-success"><CheckCircle2 size={12} />Completado</span>}
                  {course.progress?.completed === 0 && <span className="badge badge-neutral">Por comenzar</span>}
                </div>
                {course.progress && <Progress {...course.progress} />}
                <Link className="button secondary course-cta" href={action.href}>{action.label}{action.completed ? <RotateCcw size={16} /> : <ArrowRight size={17} />}</Link>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state"><BookOpen size={34} strokeWidth={1.5} /><h3>Tu próxima conversación está por comenzar</h3><p>Cuando la administración te matricule, encontrarás aquí tus lecciones y tu avance. Contacta con la academia para solicitar acceso a un curso.</p></div>
      )}
    </section>
  );
}

export function EditorialCourses({ courses, canEdit }: { courses: CourseSummary[]; canEdit: boolean }) {
  return (
    <section className="courses-section editorial-catalog" id="catalogo">
      <div className="section-title"><h2>{canEdit ? "Borradores y publicaciones" : "Catálogo interno"}</h2><span className="count-label">{courses.length} {courses.length === 1 ? "curso" : "cursos"}</span></div>
      <p className="catalog-description">{canEdit ? "El borrador es tu espacio de trabajo. La publicación vigente es la versión que reciben los estudiantes." : "La revisión corresponde al borrador. Solo los cursos con publicación vigente permiten nuevas matrículas."}</p>
      {courses.length ? (
        <div className="course-list">
          {courses.map(course => (
            <article className="course-row editorial-course-row" key={course.courseId}>
              <div className="course-level" aria-label={`Nivel ${course.level}`}>{course.level}</div>
              <div className="course-main"><h3>{course.title || "Curso sin título"}</h3><CourseMeta course={course} /></div>
              <dl className="editorial-states">
                <div><dt>Borrador</dt><dd>Revisión {course.revision}</dd></div>
                <div><dt>Publicación vigente</dt><dd><span className={`badge ${course.published ? "badge-success" : "badge-neutral"}`}>{course.published ? "Disponible" : "Sin publicar"}</span></dd></div>
              </dl>
              {canEdit && <Link className="button secondary course-cta" href={`/cursos/${course.courseId}/editar`}>Editar borrador<ArrowRight size={17} /></Link>}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><BookOpen size={34} strokeWidth={1.5} /><h3>{canEdit ? "El primer curso empieza aquí" : "El catálogo está por comenzar"}</h3><p>{canEdit ? "Crea un curso para organizar unidades, lecciones y ejercicios. Puedes guardar el borrador mientras preparas el material." : "Los cursos que creen los docentes aparecerán aquí con su estado de publicación."}</p></div>
      )}
    </section>
  );
}
