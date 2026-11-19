"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";
import type { AttemptResult, Lesson } from "@/lib/contracts";
import { api, ClientApiError, messageFrom } from "./api";
import { Notice, Progress } from "./ui";

type StoredRequest = { key: string; body: { lessonVersionId: string; answers: { activityId: string; optionId: string }[] } };
export function LessonPractice({ lesson, learnerId }: { lesson: Lesson; learnerId: string }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [changed, setChanged] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [restored, setRestored] = useState(false);
  const lastRequest = useRef<StoredRequest | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const practiceHeadingRef = useRef<HTMLHeadingElement>(null);
  const storageKey = `eia-attempt:${learnerId}:${lesson.courseId}:${lesson.lessonId}:${lesson.lessonVersionId}`;

  useEffect(() => {
    try {
      const value = sessionStorage.getItem(storageKey);
      if (value) {
        const stored = JSON.parse(value) as StoredRequest;
        if (stored.body.lessonVersionId === lesson.lessonVersionId && Array.isArray(stored.body.answers) && typeof stored.key === "string") {
          lastRequest.current = stored;
          // Browser-only recovery must happen after hydration. One queued update
          // restores the external sessionStorage snapshot without changing SSR markup.
          queueMicrotask(() => {
            setAnswers(Object.fromEntries(stored.body.answers.map(answer => [answer.activityId, answer.optionId])));
            setRestored(true);
          });
        }
      }
    } catch { /* Private browsing may disable storage; the in-memory key still protects retries. */ }
  }, [storageKey, lesson.lessonVersionId]);

  useEffect(() => { if (result) resultRef.current?.focus(); }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setChanged(false);
    if (lesson.activities.some(activity => activity.required && !answers[activity.id])) { setError("Responde todas las actividades obligatorias antes de entregar."); return; }
    const body = { lessonVersionId: lesson.lessonVersionId, answers: lesson.activities.filter(activity => answers[activity.id]).map(activity => ({ activityId: activity.id, optionId: answers[activity.id] })) };
    if (!lastRequest.current || JSON.stringify(lastRequest.current.body) !== JSON.stringify(body)) lastRequest.current = { key: crypto.randomUUID(), body };
    try { sessionStorage.setItem(storageKey, JSON.stringify(lastRequest.current)); } catch { /* See storage note above. */ }
    setBusy(true);
    try {
      const response = await api<AttemptResult>(`/courses/${lesson.courseId}/lessons/${lesson.lessonId}/attempts`, "POST", body, lastRequest.current.key);
      setResult(response); setRestored(false); router.refresh();
    } catch (e) { setError(messageFrom(e)); setChanged(e instanceof ClientApiError && e.code === "lesson_changed"); }
    finally { setBusy(false); }
  }
  function newPractice() { lastRequest.current = null; try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ } setResult(null); setAnswers({}); setError(""); setRestored(false); practiceHeadingRef.current?.focus(); }

  return <section className="practice-section"><h2 ref={practiceHeadingRef} tabIndex={-1}>Ahora, ponlo en práctica</h2><p className="muted">Elige una respuesta por actividad. Recibirás el feedback al entregar.</p>{restored && !result && <Notice tone="info">Recuperamos tu último envío. Puedes reenviarlo para consultar su resultado; se conservará el mismo intento.</Notice>}{error && <Notice>{error}{changed && <p>El docente publicó una nueva versión. <button type="button" className="text-button" onClick={() => window.location.reload()}>Cargar la lección vigente</button></p>}</Notice>}<form onSubmit={submit}><fieldset disabled={busy || result !== null}>{lesson.activities.map((activity, index) => <fieldset className="practice-activity" key={activity.id}><legend><span className="activity-count">{index + 1}</span><span lang="en">{activity.prompt}</span></legend><span className="activity-requirement">{activity.required ? "Obligatoria" : "Opcional"}</span><div className="choices">{activity.options.map(option => <label className={`choice ${answers[activity.id] === option.id ? "choice-selected" : ""}`} key={option.id}><input type="radio" name={activity.id} value={option.id} checked={answers[activity.id] === option.id} required={activity.required} onChange={() => setAnswers(previous => ({ ...previous, [activity.id]: option.id }))} /><span lang="en">{option.text}</span></label>)}</div></fieldset>)}{!result && <div className="practice-submit"><button className="button" type="submit" disabled={changed}>{busy ? "Guardando tu práctica…" : "Entregar práctica"}<ArrowRight size={18} /></button><span>Tu avance se guarda al entregar.</span></div>}</fieldset></form>{result && <div className="practice-result" ref={resultRef} tabIndex={-1} aria-live="polite"><div className="result-heading"><CheckCircle2 size={27} /><h2>Lección completada</h2></div><div className="result-summary"><div><h3>Aciertos de esta práctica</h3><p className="score">{result.score.correct}<span> / {result.score.total}</span></p><p className="muted">Los errores también son parte del aprendizaje.</p></div><div><h3>Avance del curso</h3><Progress {...result.courseProgress} /></div></div><div className="feedback-list">{result.items.map((item, index) => <div className="feedback-item" key={item.activityId}><span className={`badge ${item.correct ? "badge-success" : "badge-neutral"}`}>{item.correct ? "Correcta" : "Para repasar"}</span><strong>Actividad {lesson.activities.findIndex(activity => activity.id === item.activityId) + 1 || index + 1}</strong><p lang="en">{item.feedback}</p></div>)}</div><div className="result-actions">{result.courseProgress.nextLessonId ? <Link className="button" href={`/cursos/${lesson.courseId}/lecciones/${result.courseProgress.nextLessonId}`}>Siguiente lección<ArrowRight size={18} /></Link> : <Link className="button" href={`/cursos/${lesson.courseId}`}>Ver el curso completado<CheckCircle2 size={18} /></Link>}<button type="button" className="button ghost" onClick={newPractice}><RotateCcw size={16} />Volver a practicar</button></div><p className="field-help">Volver a practicar crea otro intento y conserva el anterior.</p></div>}</section>;
}
