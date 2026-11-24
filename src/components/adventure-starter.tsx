"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Compass, RefreshCw } from "lucide-react";
import { adventureCourseDocument } from "@/lib/adventure-templates";
import { importAdventureDraft, type AdventureImportCheckpoint } from "@/lib/adventure-import";
import { uuidSchema } from "@/lib/contracts";
import { api, messageFrom } from "./api";
import { Notice } from "./ui";
import styles from "./adventure-starter.module.css";

function readCheckpoint(raw: string | null): AdventureImportCheckpoint | null {
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || !("status" in value)) return null;
  if (value.status === "uncertain") return { status: "uncertain" };
  if ((value.status === "created" || value.status === "saved") && "courseId" in value && "revision" in value &&
    uuidSchema.safeParse(value.courseId).success && typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 1) {
    return { status: value.status, courseId: value.courseId as string, revision: value.revision };
  }
  return null;
}

export function AdventureStarter({ authorId }: { authorId: string }) {
  const router = useRouter();
  const storageKey = `eia-draft:${authorId}:adventure-import-v1`;
  const checkpointRef = useRef<AdventureImportCheckpoint | null>(null);
  const running = useRef(false);
  const [checkpoint, setCheckpoint] = useState<AdventureImportCheckpoint | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageNotice, setStorageNotice] = useState(false);

  useEffect(() => {
    let stored: AdventureImportCheckpoint | null = null;
    try { stored = readCheckpoint(sessionStorage.getItem(storageKey)); }
    catch { /* An unavailable cache does not prevent creation in this open page. */ }
    checkpointRef.current = stored;
    queueMicrotask(() => { setCheckpoint(stored); setReady(true); });
  }, [storageKey]);

  function saveCheckpoint(next: AdventureImportCheckpoint | null) {
    checkpointRef.current = next;
    setCheckpoint(next);
    try {
      if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
      else sessionStorage.removeItem(storageKey);
    } catch { setStorageNotice(true); }
  }

  async function createDraft() {
    if (running.current || !ready) return;
    running.current = true;
    setBusy(true); setError("");
    try {
      const courseId = await importAdventureDraft(adventureCourseDocument, checkpointRef.current, api, saveCheckpoint);
      router.push(`/cursos/${courseId}/editar`);
      router.refresh();
    } catch (cause) { setError(messageFrom(cause)); }
    finally { running.current = false; setBusy(false); }
  }

  const knownCourse = checkpoint && checkpoint.status !== "uncertain" ? checkpoint.courseId : null;
  const uncertain = checkpoint?.status === "uncertain";
  const saved = checkpoint?.status === "saved";

  return <section className={styles.starter} aria-labelledby="adventure-starter-heading">
    <div className={styles.content}>
      <div className={styles.heading}><Compass size={24} aria-hidden="true" /><h2 id="adventure-starter-heading">Prepara los dos módulos de aventura</h2></div>
      <p>Crea un curso A1 escolar a partir de <span lang="en">English Learning Adventure</span>, con las unidades <span lang="en">Hello, Explorer!</span> y <span lang="en">My World</span>.</p>
      <p className={styles.detail}>La plantilla incluye textos y actividades de selección para editar. Revisa el contenido y completa las actividades pendientes antes de publicar. Las ilustraciones y la experiencia interactiva se exploran en el laboratorio.</p>
      {error && <Notice>{error}</Notice>}
      {uncertain && <Notice tone="info">La creación quedó sin confirmar. Actualiza la lista y busca «{adventureCourseDocument.title}». No iniciaremos otra creación desde este intento.</Notice>}
      {checkpoint?.status === "created" && !busy && <Notice tone="info">El curso ya está creado. Puedes reintentar la carga del contenido en ese mismo borrador o abrirlo en el editor.</Notice>}
      {storageNotice && <Notice tone="info">El navegador no permite recuperar este intento al cerrar la página. Si sales, revisa tus cursos antes de volver a cargar la plantilla.</Notice>}
      <div className={styles.actions}>
        {uncertain ? <button type="button" className="button secondary" onClick={() => router.refresh()}><RefreshCw size={17} />Actualizar lista de cursos</button> : saved && knownCourse ? <Link className="button" href={`/cursos/${knownCourse}/editar`}><BookOpen size={17} />Abrir borrador de aventura</Link> : <button type="button" className="button" onClick={createDraft} disabled={!ready || busy}><BookOpen size={17} />{busy ? "Preparando el borrador…" : knownCourse ? "Reintentar carga de plantilla" : "Crear borrador con los dos módulos"}</button>}
        {knownCourse && !saved && <Link className="button secondary" href={`/cursos/${knownCourse}/editar`}>Abrir borrador</Link>}
        <Link className={styles.preview} href="/aventura">Explorar el laboratorio<ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <p className={styles.note} role="status">{busy ? "Estamos creando y guardando tu borrador. Mantén esta página abierta." : "El borrador queda privado. Podrás publicarlo desde el editor cuando esté listo."}</p>
    </div>
  </section>;
}
