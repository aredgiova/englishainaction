"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, ChevronUp, ChevronDown, Trash2, Save, Send, Eye, Download } from "lucide-react";
import { draftDocumentSchema, publishDocumentSchema, type CourseDocument, type Draft } from "@/lib/contracts";
import { api, ClientApiError, messageFrom } from "./api";
import { CourseMeta, Notice } from "./ui";
import { CoursePreview, studentPreviewOf } from "./course-preview";
import { EditorDialog } from "./editor-dialog";
import styles from "./editor-dialog.module.css";

type LessonDocument = CourseDocument["units"][number]["lessons"][number];
type ValidationIssue = { message: string; path: (string | number)[] };
type DraftRecovery = { revision: number; document: CourseDocument };
type ConflictBackup = DraftRecovery & { savedAt: string };
function parseConflictBackups(raw: string | null): ConflictBackup[] {
  if (raw === null) return [];
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Invalid conflict backups");
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid conflict backup");
    const saved = entry as Partial<ConflictBackup>;
    const parsed = draftDocumentSchema.safeParse(saved.document);
    if (!parsed.success || typeof saved.revision !== "number" || !Number.isInteger(saved.revision) || saved.revision < 0 || typeof saved.savedAt !== "string" || !Number.isFinite(Date.parse(saved.savedAt))) throw new Error("Invalid conflict backup");
    return { revision: saved.revision, document: parsed.data, savedAt: saved.savedAt };
  });
}
function fieldDescription(path: (string | number)[]) {
  const labels: Record<string, string> = { title: "título", objective: "objetivo", prompt: "pregunta", correctOptionId: "respuesta correcta", correct: "feedback si acierta", incorrect: "feedback si se equivoca", text: "texto" };
  const collections: Record<string, string> = { units: "unidad", lessons: "lección", blocks: "contenido", activities: "actividad", options: "opción" };
  const parts: string[] = [];
  path.forEach((part, index) => {
    if (typeof part !== "string" || part === "document" || part === "feedback") return;
    if (collections[part]) parts.push(`${collections[part]}${typeof path[index + 1] === "number" ? ` ${Number(path[index + 1]) + 1}` : ""}`);
    else if (labels[part]) parts.push(labels[part]);
  });
  return parts.join(" · ") || "Curso";
}
function focusField(path: (string | number)[]) {
  const targetPath = path.filter(part => part !== "document");
  let target: HTMLElement | null = null;
  while (targetPath.length && !target) {
    target = globalThis.document.querySelector<HTMLElement>(`[data-field="${targetPath.join(".")}"]`);
    if (!target) targetPath.pop();
  }
  if (target) { const disclosure = target.closest("details"); if (disclosure) disclosure.open = true; target.focus(); target.scrollIntoView({ block: "center" }); }
}
function newId() { return crypto.randomUUID(); }
function move<T>(items: T[], index: number, direction: number) { const [item] = items.splice(index, 1); items.splice(index + direction, 0, item); }
function OrderControls({ label, index, count, moveItem, remove }: { label: string; index: number; count: number; moveItem: (direction: number) => void; remove: () => void }) {
  return <div className="order-controls"><button type="button" className="icon-button" onClick={() => moveItem(-1)} disabled={index === 0} title={`Subir ${label}`} aria-label={`Subir ${label}`}><ChevronUp size={17} /></button><button type="button" className="icon-button" onClick={() => moveItem(1)} disabled={index === count - 1} title={`Bajar ${label}`} aria-label={`Bajar ${label}`}><ChevronDown size={17} /></button><button type="button" className="icon-button danger" onClick={remove} title={`Eliminar ${label}`} aria-label={`Eliminar ${label}`}><Trash2 size={16} /></button></div>;
}

export function CourseEditor({ initial, authorId }: { initial: Draft; authorId: string }) {
  const [document, setDocument] = useState(initial.document);
  const [revision, setRevision] = useState(initial.revision);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [success, setSuccess] = useState("");
  const [conflict, setConflict] = useState(false);
  const [recovery, setRecovery] = useState<DraftRecovery | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [serverPreview, setServerPreview] = useState<Draft | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [conflictBackups, setConflictBackups] = useState<ConflictBackup[]>([]);
  const [backupsPersisted, setBackupsPersisted] = useState(true);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const recoveryKey = `eia-draft:${authorId}:${initial.courseId}`;
  const conflictBackupsKey = `${recoveryKey}:conflict-backups`;

  useEffect(() => { if (error || success) feedbackRef.current?.focus(); }, [error, success]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(recoveryKey);
      if (raw) {
        const saved = JSON.parse(raw) as DraftRecovery;
        const parsed = draftDocumentSchema.safeParse(saved.document);
        if (parsed.success && Number.isInteger(saved.revision) && saved.revision >= 0) queueMicrotask(() => setRecovery({ revision: saved.revision, document: parsed.data }));
      }
    } catch { /* Browser storage is optional; the unload guard still protects work. */ }
  }, [recoveryKey]);
  useEffect(() => {
    try {
      const saved = parseConflictBackups(sessionStorage.getItem(conflictBackupsKey));
      if (saved.length) queueMicrotask(() => setConflictBackups(saved));
    } catch {
      queueMicrotask(() => setError("No pudimos recuperar las copias de conflictos guardadas en este navegador. Conservamos sus datos y tus cambios actuales."));
    }
  }, [conflictBackupsKey]);
  useEffect(() => {
    if (!dirty) return;
    try { sessionStorage.setItem(recoveryKey, JSON.stringify({ revision, document })); } catch { /* Leave the form usable when storage is unavailable. */ }
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const guardLink = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (anchor && !anchor.target && !anchor.hasAttribute("download") && anchor.href !== location.href && !window.confirm("Tienes cambios sin guardar. ¿Quieres salir del borrador?")) { event.preventDefault(); event.stopPropagation(); }
    };
    const guardLogout = (event: Event) => { if (!window.confirm("Tienes cambios sin guardar. Al cerrar sesión se descartarán. ¿Quieres continuar?")) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("eia:before-logout", guardLogout);
    globalThis.document.addEventListener("click", guardLink, true);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("eia:before-logout", guardLogout); globalThis.document.removeEventListener("click", guardLink, true); };
  }, [dirty, document, revision, recoveryKey]);
  function discardRecovery() { setRecovery(null); try { sessionStorage.removeItem(recoveryKey); } catch { /* Optional browser storage. */ } }
  function restoreRecovery() {
    if (!recovery) return;
    setDocument(recovery.document); setRevision(recovery.revision); setDirty(true); setRecovery(null);
    if (recovery.revision !== initial.revision) { setConflict(true); setError("Recuperamos tus cambios, pero el borrador guardado tiene una revisión más reciente. Compara ambas versiones antes de continuar."); }
  }

  function change(update: (draft: CourseDocument) => void) {
    setDocument(previous => { const next = structuredClone(previous); update(next); return next; });
    setDirty(true); setSuccess("");
  }
  function lessonChange(unitIndex: number, lessonIndex: number, update: (lesson: LessonDocument) => void) { change(draft => update(draft.units[unitIndex].lessons[lessonIndex])); }
  function report(e: unknown) { if (e instanceof ClientApiError && e.status === 401) { setError(""); return; } setError(messageFrom(e)); setConflict(e instanceof ClientApiError && e.code.includes("conflict")); if (e instanceof ClientApiError && e.fieldErrors) setIssues(Object.entries(e.fieldErrors).flatMap(([field, messages]) => messages.map(message => ({ message, path: field.split(".").map(part => /^\d+$/.test(part) ? Number(part) : part) })))); }
  async function saveDocument() {
    const result = await api<{ revision: number }>(`/courses/${initial.courseId}/draft`, "PUT", { expectedRevision: revision, document });
    setRevision(result.revision); setDirty(false); discardRecovery(); return result.revision;
  }
  async function save() {
    setBusy("save"); setError(""); setIssues([]); setSuccess(""); setConflict(false);
    try { await saveDocument(); setSuccess("Borrador guardado. La publicación vigente conserva su contenido."); } catch (e) { report(e); } finally { setBusy(null); }
  }
  async function viewCurrentDraft() {
    setLoadingCurrent(true);
    try { setServerPreview(await api<Draft>(`/courses/${initial.courseId}/draft`)); }
    catch (e) { report(e); }
    finally { setLoadingCurrent(false); }
  }
  function loadCurrentDraft() {
    if (!serverPreview) return;
    const snapshot: ConflictBackup = { revision, document: structuredClone(document), savedAt: new Date().toISOString() };
    // Retain an in-memory copy too, so quota/private-mode failures still allow a download.
    let nextBackups = [...conflictBackups, snapshot];
    setConflictBackups(nextBackups);
    try {
      // Never overwrite an unreadable history with an empty or partially recovered list.
      const stored = parseConflictBackups(sessionStorage.getItem(conflictBackupsKey));
      nextBackups = [...new Map([...stored, ...nextBackups].map(copy => [JSON.stringify(copy), copy])).values()];
      setConflictBackups(nextBackups);
      sessionStorage.setItem(conflictBackupsKey, JSON.stringify(nextBackups));
    } catch {
      setBackupsPersisted(false);
      setServerPreview(null);
      setError("No pudimos guardar una copia de tus cambios en este navegador. No reemplazamos el borrador: descarga tus cambios anteriores antes de continuar.");
      return;
    }
    setBackupsPersisted(true);
    setDocument(serverPreview.document);
    setRevision(serverPreview.revision);
    setDirty(false);
    discardRecovery();
    setConflict(false);
    setIssues([]);
    setError("");
    setSuccess("Cargamos la versión vigente. Tus cambios anteriores están en una copia descargable; reincorpora lo necesario y guarda sobre esta revisión.");
    setServerPreview(null);
  }
  function downloadConflictBackups() {
    const data = JSON.stringify({ format: "english-in-action-conflict-backups", courseId: initial.courseId, authorId, backups: conflictBackups }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const anchor = globalThis.document.createElement("a");
    anchor.href = url;
    anchor.download = `english-in-action-${initial.courseId}-mis-cambios.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function requestPublication() {
    setError(""); setIssues([]); setSuccess(""); setConflict(false);
    const validation = publishDocumentSchema.safeParse(document);
    if (!validation.success) {
      setError("Todavía falta completar el material para publicar. Puedes guardar este borrador tal como está.");
      setIssues(validation.error.issues.slice(0, 20).map(issue => ({ message: issue.message, path: issue.path.filter((part): part is string | number => typeof part !== "symbol") })));
      return;
    }
    setPublicationOpen(true);
  }
  async function publish() {
    setPublicationOpen(false);
    setBusy("publish");
    try { const currentRevision = dirty ? await saveDocument() : revision; await api(`/courses/${initial.courseId}/releases`, "POST", { expectedRevision: currentRevision }); setSuccess("Curso publicado. Los estudiantes matriculados ya pueden acceder a esta versión."); }
    catch (e) { report(e); } finally { setBusy(null); }
  }
  function confirmDelete(label: string, remove: () => void) { if (window.confirm(`¿Eliminar ${label} del borrador? El cambio se aplicará cuando guardes.`)) remove(); }

  return <div className="editor"><div className={`editor-toolbar ${styles.toolbar}`}><div><strong>Borrador privado</strong><span>Revisión {revision} · {dirty ? "Cambios sin guardar" : "Guardado"}</span></div><div className={`toolbar-actions ${styles.toolbarActions}`}><button type="button" className="button secondary" onClick={() => setPreviewOpen(true)} disabled={busy !== null || recovery !== null}><Eye size={17} />Previsualizar como estudiante</button><button className="button secondary" onClick={save} disabled={busy !== null || recovery !== null}><Save size={17} />{busy === "save" ? "Guardando…" : "Guardar borrador"}</button><button className="button" onClick={requestPublication} disabled={busy !== null || recovery !== null}><Send size={17} />{busy === "publish" ? "Publicando…" : "Publicar curso"}</button></div></div>{recovery && <Notice tone="info"><strong>Encontramos cambios sin guardar de esta sesión.</strong><p>Recupéralos para continuar o descártalos para abrir el borrador guardado.</p><div className="form-actions"><button type="button" className="button secondary" onClick={restoreRecovery}>Recuperar cambios</button><button type="button" className="button ghost" onClick={discardRecovery}>Descartar cambios</button></div></Notice>}<div ref={feedbackRef} tabIndex={-1}>{error && <Notice><strong>{error}</strong>{issues.length > 0 && <ul>{issues.map((issue, index) => <li key={index}><button type="button" className="validation-link" onClick={() => focusField(issue.path)}>{fieldDescription(issue.path)}: {issue.message}</button></li>)}</ul>}{conflict && <p>Tus cambios siguen en pantalla. Consulta el borrador guardado para comparar antes de continuar. <button type="button" className="text-button" onClick={viewCurrentDraft} disabled={loadingCurrent || busy !== null}>{loadingCurrent ? "Consultando versión…" : "Ver versión vigente"}</button></p>}</Notice>}{success && <Notice tone="success">{success}</Notice>}</div>{conflictBackups.length > 0 && <Notice tone="info"><strong>Conservamos tus cambios anteriores.</strong><p>{backupsPersisted ? `${conflictBackups.length} ${conflictBackups.length === 1 ? "copia completa disponible" : "copias completas disponibles"} en esta sesión del navegador.` : "No pudimos guardar todas las copias en este navegador. Descárgalas antes de recargar o salir."} Para reincorporar cambios, consulta el archivo y edita manualmente sobre la versión vigente. Las copias se eliminan al cerrar sesión.</p><div className="form-actions"><button type="button" className="button secondary" onClick={downloadConflictBackups}><Download size={17} />Descargar mis cambios anteriores</button></div></Notice>}<fieldset className="editor-fields" disabled={busy !== null || recovery !== null}><section className="editor-metadata"><h2>Información del curso</h2><div className="form-grid"><label className="span-two">Título<input data-field="title" value={document.title} maxLength={200} onChange={event => change(draft => { draft.title = event.target.value; })} /></label><label>Nivel MCER<select value={document.level} onChange={event => change(draft => { draft.level = event.target.value as CourseDocument["level"]; })}>{["A1", "A2", "B1", "B2", "C1", "C2"].map(level => <option key={level}>{level}</option>)}</select></label><label>Público<select value={document.audience} onChange={event => change(draft => { draft.audience = event.target.value as CourseDocument["audience"]; })}><option value="school">Escolar</option><option value="university">Universitario</option><option value="professional">Profesional</option></select></label></div></section><section className="document-units" data-field="units" tabIndex={-1}><div className="section-title"><h2>Unidades y lecciones</h2><span className="count-label">{document.units.length} unidades</span></div>{!document.units.length && <div className="inline-empty"><p>Organiza el primer recorrido.</p><span>Añade una unidad y crea sus lecciones, contenidos y ejercicios.</span></div>}{document.units.map((unit, unitIndex) => <section className="unit-editor" key={unit.id} data-field={`units.${unitIndex}`} tabIndex={-1}><div className="unit-editor-heading"><h3>Unidad {unitIndex + 1}</h3><OrderControls label={`unidad ${unitIndex + 1}`} index={unitIndex} count={document.units.length} moveItem={direction => change(draft => move(draft.units, unitIndex, direction))} remove={() => confirmDelete("esta unidad y todas sus lecciones", () => change(draft => { draft.units.splice(unitIndex, 1); }))} /></div><label>Título de la unidad<input data-field={`units.${unitIndex}.title`} value={unit.title} maxLength={200} placeholder="Por ejemplo: Meeting new people" onChange={event => change(draft => { draft.units[unitIndex].title = event.target.value; })} /></label><div className="lesson-editors" data-field={`units.${unitIndex}.lessons`} tabIndex={-1}>{unit.lessons.map((lesson, lessonIndex) => <details className="lesson-editor" key={lesson.id} open data-field={`units.${unitIndex}.lessons.${lessonIndex}`} tabIndex={-1}><summary><span>Lección {lessonIndex + 1}</span><strong>{lesson.title || "Nueva lección"}</strong><span className="details-hint">Editar</span></summary><div className="lesson-editor-body"><div className="lesson-editor-tools"><span className="muted">Contenido y práctica en inglés</span><OrderControls label={`lección ${lessonIndex + 1}`} index={lessonIndex} count={unit.lessons.length} moveItem={direction => change(draft => move(draft.units[unitIndex].lessons, lessonIndex, direction))} remove={() => confirmDelete("esta lección", () => change(draft => { draft.units[unitIndex].lessons.splice(lessonIndex, 1); }))} /></div><label>Título de la lección<input data-field={`units.${unitIndex}.lessons.${lessonIndex}.title`} lang="en" value={lesson.title} maxLength={200} onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.title = event.target.value; })} /></label><label>Objetivo observable<textarea data-field={`units.${unitIndex}.lessons.${lessonIndex}.objective`} lang="en" rows={2} value={lesson.objective} maxLength={4000} placeholder="By the end of this lesson, you can…" onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.objective = event.target.value; })} /></label><div className="editor-subsection" data-field={`units.${unitIndex}.lessons.${lessonIndex}.blocks`} tabIndex={-1}><h4>Contenido</h4>{lesson.blocks.map((block, blockIndex) => <div className="block-editor" key={block.id}><div className="field-row-heading"><span>Texto {blockIndex + 1}</span><OrderControls label={`texto ${blockIndex + 1}`} index={blockIndex} count={lesson.blocks.length} moveItem={direction => lessonChange(unitIndex, lessonIndex, item => move(item.blocks, blockIndex, direction))} remove={() => confirmDelete("este bloque de texto", () => lessonChange(unitIndex, lessonIndex, item => { item.blocks.splice(blockIndex, 1); }))} /></div><label className="sr-only" htmlFor={`text-${block.id}`}>Texto {blockIndex + 1}</label><textarea data-field={`units.${unitIndex}.lessons.${lessonIndex}.blocks.${blockIndex}.text`} id={`text-${block.id}`} lang="en" rows={6} value={block.text} maxLength={20000} placeholder="Write a dialogue or reading text…" onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.blocks[blockIndex].text = event.target.value; })} /></div>)}<button className="button small secondary" type="button" disabled={lesson.blocks.length >= 100} onClick={() => lessonChange(unitIndex, lessonIndex, item => { item.blocks.push({ id: newId(), type: "text", text: "" }); })}><Plus size={16} />Añadir texto</button></div><div className="editor-subsection" data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities`} tabIndex={-1}><h4>Práctica de opción única</h4>{lesson.activities.map((activity, activityIndex) => <div className="activity-editor" key={activity.id} data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities.${activityIndex}`} tabIndex={-1}><div className="field-row-heading"><strong>Actividad {activityIndex + 1}</strong><OrderControls label={`actividad ${activityIndex + 1}`} index={activityIndex} count={lesson.activities.length} moveItem={direction => lessonChange(unitIndex, lessonIndex, item => move(item.activities, activityIndex, direction))} remove={() => confirmDelete("esta actividad", () => lessonChange(unitIndex, lessonIndex, item => { item.activities.splice(activityIndex, 1); }))} /></div><label>Pregunta o instrucción<textarea data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities.${activityIndex}.prompt`} lang="en" rows={2} value={activity.prompt} maxLength={4000} onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.activities[activityIndex].prompt = event.target.value; })} /></label><label className="checkbox-label"><input type="checkbox" checked={activity.required} onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.activities[activityIndex].required = event.target.checked; })} />Actividad obligatoria</label><div className="option-editors" data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities.${activityIndex}.options`} tabIndex={-1}>{activity.options.map((option, optionIndex) => <div className="option-editor" key={option.id}><label>Opción {optionIndex + 1}<input data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities.${activityIndex}.options.${optionIndex}.text`} lang="en" value={option.text} maxLength={2000} onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.activities[activityIndex].options[optionIndex].text = event.target.value; })} /></label><OrderControls label={`opción ${optionIndex + 1}`} index={optionIndex} count={activity.options.length} moveItem={direction => lessonChange(unitIndex, lessonIndex, item => move(item.activities[activityIndex].options, optionIndex, direction))} remove={() => lessonChange(unitIndex, lessonIndex, item => { const target = item.activities[activityIndex]; const [removed] = target.options.splice(optionIndex, 1); if (target.correctOptionId === removed.id) target.correctOptionId = ""; })} /></div>)}<button className="button small ghost" type="button" disabled={activity.options.length >= 20} onClick={() => lessonChange(unitIndex, lessonIndex, item => { item.activities[activityIndex].options.push({ id: newId(), text: "" }); })}><Plus size={15} />Añadir opción</button></div><div className="answer-key"><h5>Corrección privada del docente</h5><label>Respuesta correcta<select data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities.${activityIndex}.correctOptionId`} value={activity.correctOptionId} onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.activities[activityIndex].correctOptionId = event.target.value; })}><option value="">Selecciona la respuesta correcta</option>{activity.options.map((option, optionIndex) => <option key={option.id} value={option.id}>{optionIndex + 1}. {option.text || "Opción sin texto"}</option>)}</select></label><div className="form-grid"><label>Feedback si acierta<textarea data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities.${activityIndex}.feedback.correct`} lang="en" rows={3} value={activity.feedback.correct} maxLength={2000} onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.activities[activityIndex].feedback.correct = event.target.value; })} /></label><label>Feedback si se equivoca<textarea data-field={`units.${unitIndex}.lessons.${lessonIndex}.activities.${activityIndex}.feedback.incorrect`} lang="en" rows={3} value={activity.feedback.incorrect} maxLength={2000} onChange={event => lessonChange(unitIndex, lessonIndex, item => { item.activities[activityIndex].feedback.incorrect = event.target.value; })} /></label></div></div></div>)}<button className="button small secondary" type="button" disabled={lesson.activities.length >= 100} onClick={() => lessonChange(unitIndex, lessonIndex, item => { item.activities.push({ id: newId(), type: "choice", prompt: "", required: true, options: [{ id: newId(), text: "" }, { id: newId(), text: "" }], correctOptionId: "", feedback: { correct: "", incorrect: "" } }); })}><Plus size={16} />Añadir actividad</button></div></div></details>)}</div><button className="button secondary" type="button" disabled={unit.lessons.length >= 100} onClick={() => change(draft => { draft.units[unitIndex].lessons.push({ id: newId(), title: "", objective: "", blocks: [], activities: [] }); })}><Plus size={17} />Añadir lección</button></section>)}<button className="button secondary" type="button" disabled={document.units.length >= 100} onClick={() => change(draft => { draft.units.push({ id: newId(), title: "", lessons: [] }); })}><Plus size={18} />Añadir unidad</button></section></fieldset><p className="learning-note">Antes de publicar, valida los objetivos y el material que utilizarás con estudiantes reales. Cada lección necesita contenido, una actividad obligatoria y feedback.</p>{previewOpen && <CoursePreview document={studentPreviewOf(document)} onClose={() => setPreviewOpen(false)} />}{serverPreview && <CoursePreview document={studentPreviewOf(serverPreview.document)} savedRevision={serverPreview.revision} onClose={() => setServerPreview(null)} onLoadCurrent={loadCurrentDraft} />}{publicationOpen && <EditorDialog title="Publicar este curso" closeLabel="Seguir editando" onClose={() => setPublicationOpen(false)}><p>Los estudiantes matriculados verán esta versión del curso. Los intentos anteriores se conservan.</p><section className={styles.publicationSummary} aria-label="Contenido que se publicará"><h3 lang="en">{document.title}</h3><CourseMeta course={document} /><p>{document.units.length} {document.units.length === 1 ? "unidad" : "unidades"} · {document.units.reduce((total, unit) => total + unit.lessons.length, 0)} lecciones</p><ol className={styles.publicationUnits}>{document.units.map((unit, unitIndex) => <li key={unit.id}><strong>Unidad {unitIndex + 1}: <span lang="en">{unit.title}</span></strong><ol>{unit.lessons.map(lesson => <li key={lesson.id} lang="en">{lesson.title}</li>)}</ol></li>)}</ol></section><p>{dirty ? "Se guardarán tus cambios antes de publicar." : `Se publicará el borrador guardado, revisión ${revision}.`} Comprueba que los objetivos y el material estén listos para tus estudiantes.</p><div className={styles.publicationActions}><button type="button" className="button secondary" onClick={() => setPublicationOpen(false)}>Cancelar publicación</button><button type="button" className="button" onClick={publish}><Send size={17} />Confirmar publicación</button></div></EditorDialog>}</div>;
}
