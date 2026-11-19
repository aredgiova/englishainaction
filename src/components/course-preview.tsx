"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CourseDocument, Lesson } from "@/lib/contracts";
import { EditorDialog } from "./editor-dialog";
import { CourseMeta } from "./ui";
import styles from "./editor-dialog.module.css";

type PreviewLesson = Pick<Lesson, "title" | "objective" | "blocks" | "activities"> & { id: string };
type PreviewDocument = Pick<CourseDocument, "title" | "level" | "audience"> & {
  units: { id: string; title: string; lessons: PreviewLesson[] }[];
};

/** The preview receives student-visible fields only, including for incomplete drafts. */
export function studentPreviewOf(document: CourseDocument): PreviewDocument {
  return {
    title: document.title,
    level: document.level,
    audience: document.audience,
    units: document.units.map(unit => ({
      id: unit.id,
      title: unit.title,
      lessons: unit.lessons.map(lesson => ({
        id: lesson.id,
        title: lesson.title,
        objective: lesson.objective,
        blocks: lesson.blocks.map(block => ({ id: block.id, type: block.type, text: block.text })),
        activities: lesson.activities.map(activity => ({
          id: activity.id,
          type: activity.type,
          prompt: activity.prompt,
          required: activity.required,
          options: activity.options.map(option => ({ id: option.id, text: option.text })),
        })),
      })),
    })),
  };
}

export function CoursePreview({ document, onClose, savedRevision, onLoadCurrent }: { document: PreviewDocument; onClose: () => void; savedRevision?: number; onLoadCurrent?: () => void }) {
  const lessons = document.units.flatMap((unit, unitIndex) => unit.lessons.map((lesson, lessonIndex) => ({
    ...lesson,
    unitTitle: unit.title || `Unidad ${unitIndex + 1} sin título`,
    unitIndex,
    lessonIndex,
  })));
  const [selectedId, setSelectedId] = useState(lessons[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const lessonIndex = lessons.findIndex(lesson => lesson.id === selectedId);
  const lesson = lessons[lessonIndex];
  const lessonHeading = useRef<HTMLHeadingElement>(null);

  function selectLesson(id: string, focusHeading = false) {
    setSelectedId(id);
    if (focusHeading) requestAnimationFrame(() => lessonHeading.current?.focus());
  }

  return <EditorDialog title={savedRevision === undefined ? "Vista de estudiante" : "Versión vigente del borrador"} closeLabel="Volver al editor" onClose={onClose} wide>
    <p className={styles.previewNote}>{savedRevision === undefined ? "Vista del borrador local. Puedes probar la selección de respuestas; aquí no se entregan prácticas ni se modifica el avance." : `Borrador guardado en el servidor, revisión ${savedRevision}. Tus cambios locales siguen en el editor; esta consulta no los reemplaza.`}</p>
    {onLoadCurrent && <div className="notice notice-info"><p>Al cargar esta versión, sustituiremos el contenido y la revisión del editor. Antes conservaremos una copia completa de tus cambios locales para descargarla y reincorporarlos manualmente.</p><div className="form-actions"><button type="button" className="button" onClick={onLoadCurrent}>Cargar versión vigente</button></div></div>}
    <div className={styles.courseHeading}>
      <h3 lang="en">{document.title || "Curso sin título"}</h3>
      <CourseMeta course={document} />
    </div>
    {!lesson ? <div className="inline-empty"><p>Aún no hay lecciones para previsualizar.</p><span>Vuelve al editor y añade la primera lección a una unidad.</span></div> : <>
      <label className={styles.lessonPicker}>Lección de la vista previa
        <select value={selectedId} onChange={event => selectLesson(event.target.value)}>
          {document.units.filter(unit => unit.lessons.length > 0).map((unit, unitIndex) => <optgroup key={unit.id} label={unit.title || `Unidad ${unitIndex + 1} sin título`}>
            {unit.lessons.map((item, itemIndex) => <option key={item.id} value={item.id}>{itemIndex + 1}. {item.title || "Lección sin título"}</option>)}
          </optgroup>)}
        </select>
      </label>
      <article className={styles.lesson}>
        <div className="lesson-title">
          <h3 className={styles.lessonTitle} ref={lessonHeading} tabIndex={-1} lang="en">{lesson.title || "Lección sin título"}</h3>
          <p className={styles.lessonPosition}><span lang="en">{lesson.unitTitle}</span> · Lección {lesson.lessonIndex + 1}</p>
        </div>
        <section className="lesson-objective"><h4>Tu objetivo</h4><p lang={lesson.objective ? "en" : undefined}>{lesson.objective || "El objetivo de esta lección está pendiente."}</p></section>
        {lesson.blocks.length ? lesson.blocks.map(block => <div className="reading-block" key={block.id} lang={block.text ? "en" : undefined}>{block.text || "Este bloque de texto está pendiente."}</div>) : <p className={styles.pending}>Esta lección todavía no tiene contenido.</p>}
        <section className="practice-section">
          <h4>Ahora, ponlo en práctica</h4>
          <p className="muted">Elige una respuesta por actividad. El estudiante recibe el feedback al entregar.</p>
          {lesson.activities.length ? lesson.activities.map((activity, activityIndex) => <fieldset className="practice-activity" key={activity.id}>
            <legend><span className="activity-count">{activityIndex + 1}</span><span lang={activity.prompt ? "en" : undefined}>{activity.prompt || "Pregunta pendiente"}</span></legend>
            <span className="activity-requirement">{activity.required ? "Obligatoria" : "Opcional"}</span>
            <div className="choices">{activity.options.map((option, optionIndex) => {
              const answerKey = `${lesson.id}:${activity.id}`;
              return <label className={`choice ${answers[answerKey] === option.id ? "choice-selected" : ""}`} key={option.id}>
                <input type="radio" name={`preview-${answerKey}`} value={option.id} checked={answers[answerKey] === option.id} onChange={() => setAnswers(previous => ({ ...previous, [answerKey]: option.id }))} />
                <span lang={option.text ? "en" : undefined}>{option.text || `Opción ${optionIndex + 1} pendiente`}</span>
              </label>;
            })}</div>
            {!activity.options.length && <p className={styles.pending}>Añade opciones en el editor.</p>}
          </fieldset>) : <p className={styles.pending}>Esta lección todavía no tiene actividades.</p>}
        </section>
      </article>
      <nav className={styles.previewNavigation} aria-label="Recorrido de la vista previa">
        <button type="button" className="button secondary" disabled={lessonIndex === 0} onClick={() => selectLesson(lessons[lessonIndex - 1].id, true)}><ArrowLeft size={17} />Lección anterior</button>
        <button type="button" className="button secondary" disabled={lessonIndex === lessons.length - 1} onClick={() => selectLesson(lessons[lessonIndex + 1].id, true)}>Siguiente lección<ArrowRight size={17} /></button>
      </nav>
    </>}
  </EditorDialog>;
}
