"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Compass, KeyRound, Volume2, Square, RotateCcw, Lightbulb, Mic, PencilLine } from "lucide-react";
import type { AdventureMission, AdventureStep } from "@/lib/adventure-content";
import styles from "./adventure.module.css";

export function MissionPlayer({ mission }: { mission: AdventureMission }) {
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [finished, setFinished] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = mission.steps[index];
  const storageKey = `eia-adventure-preview:v1:${mission.id}`;

  useEffect(() => {
    let ids: string[] = [];
    let failed = false;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(stored)) ids = [...new Set(stored.filter((id): id is string => typeof id === "string" && mission.steps.some(item => item.id === id)))];
    } catch { failed = true; }
    queueMicrotask(() => { setCompleted(ids); setStorageReady(true); setStorageError(failed); });
  }, [storageKey, mission.steps]);

  function save(ids: string[]) {
    setCompleted(ids);
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); }
    catch { setStorageError(true); }
  }
  function goTo(next: number) {
    setIndex(next); setFinished(false);
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: "instant", block: "start" }); });
  }
  function completeStep() {
    const ids = completed.includes(step.id) ? completed : [...completed, step.id];
    save(ids);
    if (index < mission.steps.length - 1) goTo(index + 1);
    else if (ids.length === mission.steps.length) { setFinished(true); requestAnimationFrame(() => heading.current?.focus()); }
    else goTo(mission.steps.findIndex(item => !ids.includes(item.id)));
  }

  return <main id="adventure-content" className={styles.player}>
    <div className={styles.playerTop}><Link href="/aventura#missions"><ArrowLeft size={17} /> Volver al mapa</Link><span>Recorrido de prueba · {mission.level}</span></div>
    <div className={styles.playerLayout}>
      <aside className={styles.route}>
        <div className={styles.routeHeading}><Compass size={22} /><span>Misión {mission.number}</span></div><h1 lang="en">{mission.title}</h1><p lang="en">{mission.place}</p>
        <div className={styles.routeProgress}><span>{completed.length} de {mission.steps.length} paradas completadas</span><progress value={completed.length} max={mission.steps.length} aria-label="Paradas completadas en esta prueba" /></div>
        <nav aria-label="Paradas de la misión"><ol>{mission.steps.map((item, position) => <li key={item.id}><button type="button" className={position === index && !finished ? styles.activeStep : ""} aria-current={position === index && !finished ? "step" : undefined} onClick={() => goTo(position)}><span className={styles.stepNumber}>{completed.includes(item.id) ? <Check size={14} aria-label="Completada" /> : position + 1}</span><span lang="en">{item.title}</span></button></li>)}</ol></nav>
        <button type="button" disabled={!storageReady || !completed.length} className={styles.reset} onClick={() => { save([]); goTo(0); }}><RotateCcw size={14} /> Reiniciar recorrido</button>
      </aside>
      <article className={styles.lessonPanel}>
        <div className={styles.lessonArt}><Image src={mission.image} alt={mission.imageAlt} fill sizes="(max-width: 760px) 100vw, 75vw" preload /><span className={styles.lessonPlace} lang="en"><Compass size={15} />{mission.place}</span></div>
        <div className={styles.lessonBody}>
          {finished ? <section className={styles.reward} aria-live="polite"><div className={styles.rewardKey}><KeyRound size={48} /></div><h2 ref={heading} tabIndex={-1}>¡Una nueva llave para tu mapa!</h2><p lang="en">{mission.reward}</p><p>Completaste las {mission.steps.length} paradas de esta prueba. Sigue practicando: este recorrido no certifica el dominio del idioma.</p><div className={styles.rewardActions}><button className={styles.secondary} onClick={() => goTo(0)}>Repasar la misión</button><Link className={styles.primary} href={mission.number === 1 ? "/aventura/my-world" : "/aventura"}>{mission.number === 1 ? "Continuar a My World" : "Volver al mapa"}<ArrowRight size={18} /></Link></div></section> : <>
            <div className={styles.stepMeta}><span>{step.stage}</span><span>Parada {index + 1} / {mission.steps.length}</span></div>
            <h2 ref={heading} tabIndex={-1} className={styles.stepTitle} lang="en">{step.title}</h2>
            <StepContent key={step.id} step={step} onComplete={completeStep} last={index === mission.steps.length - 1} ready={storageReady} />
            {index > 0 && <button className={styles.previous} onClick={() => goTo(index - 1)}><ArrowLeft size={16} /> Parada anterior</button>}
          </>}
        </div>
      </article>
    </div>
    <div className={styles.playerNote}><p>{mission.sourceNote}</p><p>{storageError ? "El navegador no permite guardar este recorrido. Puedes seguir practicando durante esta visita." : "Solo las paradas completadas se guardan en este navegador. Tus textos y ensayos orales no se envían ni se guardan como calificaciones."}</p></div>
  </main>;
}

function StepContent({ step, onComplete, last, ready }: { step: AdventureStep; onComplete: () => void; last: boolean; ready: boolean }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState(false);
  const [writing, setWriting] = useState("");
  const [writingReviewed, setWritingReviewed] = useState(false);
  const [spoken, setSpoken] = useState(false);
  const [error, setError] = useState("");
  const [audioError, setAudioError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [speed, setSpeed] = useState(0.85);
  const speechToken = useRef(0);
  const result = useRef<HTMLDivElement>(null);
  const questions = step.questions ?? [];

  useEffect(() => () => { speechToken.current++; if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  function stopAudio() { speechToken.current++; if ("speechSynthesis" in window) window.speechSynthesis.cancel(); setSpeaking(false); }
  function listen(text: string) {
    setAudioError("");
    if (!("speechSynthesis" in window)) { setAudioError("La voz del dispositivo no está disponible. Puedes practicar con el texto del ejemplo."); return; }
    stopAudio();
    const token = ++speechToken.current;
    const voice = new SpeechSynthesisUtterance(text);
    voice.lang = "en-US"; voice.rate = speed;
    const english = window.speechSynthesis.getVoices().find(item => item.lang.startsWith("en"));
    if (english) voice.voice = english;
    voice.onend = () => { if (token === speechToken.current) setSpeaking(false); };
    voice.onerror = event => { if (token !== speechToken.current) return; setSpeaking(false); if (event.error !== "canceled" && event.error !== "interrupted") setAudioError("No se pudo reproducir la voz. Puedes volver a intentarlo o leer el texto."); };
    setSpeaking(true); window.speechSynthesis.speak(voice);
  }
  function checkAnswers() {
    if (questions.some(question => answers[question.id] === undefined)) { setError("Elige una respuesta en cada pregunta para comprobarlas."); return; }
    setError(""); setChecked(true); requestAnimationFrame(() => result.current?.focus());
  }
  function advance() {
    if (questions.length && !checked) { setError("Comprueba tus respuestas antes de continuar."); return; }
    if (step.writing && (!writing.trim() || !writingReviewed)) { setError("Escribe tu respuesta y revísala con el modelo antes de continuar."); return; }
    if (step.speaking && !spoken) { setError("Ensaya el ejemplo en voz alta y marca tu práctica para continuar."); return; }
    stopAudio(); onComplete();
  }

  return <>
    <p className={styles.instruction}>{step.instruction}</p>
    {step.paragraphs.map((paragraph, i) => <p className={styles.lessonText} key={i}>{paragraph}</p>)}
    {!!step.dialogue?.length && <section className={styles.dialogue} aria-label="Diálogo de los exploradores">{step.dialogue.map((line, i) => <div className={styles.dialogueLine} key={i}><span className={styles.speaker}>{line.speaker}</span><p lang="en">{line.text}</p><button className={styles.audioIcon} aria-label={`Escuchar a ${line.speaker}`} onClick={() => listen(line.text)}><Volume2 size={17} /></button></div>)}</section>}
    {!!step.vocabulary?.length && <div className={styles.vocabulary}>{step.vocabulary.map(word => <button key={word.en} onClick={() => listen(word.en)} aria-label={`Escuchar ${word.en}`}><Volume2 size={18} /><span><strong lang="en">{word.en}</strong><small>{word.es}</small></span></button>)}</div>}
    {step.listening && <section className={styles.listening}><h3 lang="en">{step.listening.title}</h3><div className={styles.audioControls}><button className={styles.secondary} onClick={() => listen(step.listening!.script)}><Volume2 size={18} /> Escuchar ejemplo</button><label>Velocidad<select value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={0.7}>Más despacio</option><option value={0.85}>Pausada</option><option value={1}>Normal</option></select></label></div><details><summary>Leer la transcripción</summary><p lang="en">{step.listening.script}</p></details></section>}
    {(step.listening || step.dialogue?.length || step.vocabulary?.length || step.speaking) && <div className={styles.audioStatus}><span>Audio con la voz del dispositivo.</span>{speaking && <button onClick={stopAudio}><Square size={12} /> Detener audio</button>}{audioError && <p role="status">{audioError}</p>}</div>}
    {questions.length > 0 && <section className={styles.quiz}><h3>Tu turno, explorer</h3><p>Elige tus respuestas. Puedes intentarlo todas las veces que quieras.</p>{questions.map((question, i) => <fieldset className={styles.question} key={question.id}><legend><span>{i + 1}.</span> <span lang="en">{question.prompt}</span></legend><div className={styles.options}>{question.options.map((option, optionIndex) => <label className={answers[question.id] === optionIndex ? styles.selectedOption : ""} key={optionIndex}><input type="radio" name={`${step.id}-${question.id}`} checked={answers[question.id] === optionIndex} onChange={() => { setAnswers(previous => ({ ...previous, [question.id]: optionIndex })); setChecked(false); setError(""); }} /><span lang="en">{option}</span></label>)}</div>{checked && <div className={answers[question.id] === question.answer ? styles.correct : styles.hint}>{answers[question.id] === question.answer ? <CheckCircle2 size={18} /> : <Lightbulb size={18} />}<p><strong>{answers[question.id] === question.answer ? "¡Bien hecho! " : "Sigue practicando. "}</strong><span>{question.feedback}</span></p></div>}</fieldset>)}<button className={styles.secondary} onClick={checkAnswers}><Check size={18} /> Comprobar respuestas</button>{checked && <div className={styles.quizResult} ref={result} tabIndex={-1} role="status">{questions.filter(question => answers[question.id] === question.answer).length} de {questions.length} respuestas correctas. Puedes cambiar tus respuestas y volver a comprobarlas.</div>}</section>}
    {step.speaking && <section className={styles.production}><h3><Mic size={20} /> Practica en voz alta</h3><blockquote lang="en">{step.speaking.model}</blockquote><button type="button" className={styles.secondary} onClick={() => listen(step.speaking!.model)}><Volume2 size={18} /> Escuchar modelo oral</button><ul>{step.speaking.checklist.map(item => <li key={item}><Check size={16} />{item}</li>)}</ul><p>Usa un personaje inventado si prefieres. Esta práctica no graba tu voz ni evalúa tu pronunciación.</p><label className={styles.checkLabel}><input type="checkbox" checked={spoken} onChange={event => setSpoken(event.target.checked)} />Ensayé en voz alta con ayuda del modelo.</label></section>}
    {step.writing && <section className={styles.production}><h3><PencilLine size={20} /> Escribe tu versión</h3><label className={styles.writingLabel}>{step.writing.label}<textarea rows={5} maxLength={2000} value={writing} onChange={event => { setWriting(event.target.value); setWritingReviewed(false); }} placeholder={step.writing.placeholder} lang="en" /></label><details><summary>Ver un modelo</summary><p lang="en">{step.writing.model}</p></details><p>Puedes usar datos imaginarios. Tu texto se borra al cambiar de parada. La revisión académica de escritura corresponde al docente.</p><label className={styles.checkLabel}><input type="checkbox" checked={writingReviewed} onChange={event => setWritingReviewed(event.target.checked)} />Comparé mi texto con el modelo.</label></section>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.lessonActions}><button className={styles.primary} disabled={!ready} onClick={advance}>{last ? "Completar el recorrido" : "Completar y continuar"}<ArrowRight size={18} /></button><span>Avanza a tu ritmo. Puedes volver a cualquier parada.</span></div>
  </>;
}
