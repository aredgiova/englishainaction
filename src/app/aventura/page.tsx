import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, Headphones, MessageCircle, KeyRound, BookOpen, Sparkles } from "lucide-react";
import { adventureMissions } from "@/lib/adventure-content";
import styles from "@/components/adventure/adventure.module.css";

export default function AdventurePage() {
  return <main id="adventure-content">
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <h1>Cada palabra<br /> abre un <span>mundo.</span></h1>
        <p>Las palabras han desaparecido. Dos lugares esperan tu ayuda. Explora, aprende inglés y recupera las primeras llaves del mapa.</p>
        <Link className={styles.primary} href="/aventura/hello-explorer">Comenzar mi aventura <ArrowRight size={20} /></Link>
        <div className={styles.heroMeta}><span><Compass size={16} /> Nivel A1.1</span><span>Aprende a tu ritmo</span></div>
      </div>
      <div className={styles.heroArt}><Image src="/adventure/welcome-harbor.png" alt="Alex y Byte te dan la bienvenida a un puerto de aventuras con un faro, barcos y casas de colores." fill sizes="(max-width: 760px) 100vw, 65vw" preload /><div className={styles.sceneCaption}><span className={styles.liveDot} />Tu primera parada: <strong lang="en">Welcome Harbor</strong></div></div>
    </section>
    <section id="missions" className={styles.missions}>
      <div className={styles.sectionTitle}><div><h2>Tu mapa empieza aquí</h2><p>Una misión, nuevas palabras y un lugar por reconectar.</p></div><span className={styles.level}>The Discovery Islands · A1.1</span></div>
      <div className={styles.missionGrid}>{adventureMissions.map(mission => <Link key={mission.id} href={`/aventura/${mission.id}`} className={styles.missionCard}>
        <div className={styles.cardArt}><Image src={mission.image} alt={mission.imageAlt} fill sizes="(max-width: 760px) 100vw, 50vw" /><span className={styles.missionNumber}>Misión {mission.number}</span></div>
        <div className={styles.cardBody}><div className={styles.cardPlace}><Compass size={15} /><span lang="en">{mission.place}</span></div><h3 lang="en">{mission.title}</h3><p>{mission.description}</p><div className={styles.cardBottom}><span>{mission.steps.length} paradas de aprendizaje</span><span className={styles.cardArrow} aria-hidden="true"><ArrowRight size={22} /></span></div></div>
      </Link>)}</div>
    </section>
    <section className={styles.guide} id="guide"><div><Sparkles size={30} /><h2>El inglés es tu herramienta.<br />La aventura es tuya.</h2><p>Alex, Mia y Byte te acompañan. Puedes repetir las actividades, escuchar los ejemplos y avanzar sin cronómetro.</p></div><ol><li><BookOpen /><div><h3>Explora y descubre</h3><p>Conoce la historia y las palabras que necesitas.</p></div></li><li><Headphones /><div><h3>Escucha y practica</h3><p>Prueba tus respuestas y aprende con las pistas de Byte.</p></div></li><li><MessageCircle /><div><h3>Usa tu voz y tus palabras</h3><p>Ensaya en voz alta y crea una presentación o descripción.</p></div></li><li><KeyRound /><div><h3>Reconstruye el mapa</h3><p>Completa el recorrido de prueba y consigue sus llaves.</p></div></li></ol></section>
    <aside className={styles.pilotNote}><strong>Estamos construyendo esta aventura.</strong><p>Esta versión permite revisar las dos primeras misiones. Conserva solo las paradas completadas en este navegador; no registra notas académicas. La misión 2 desarrolla actividades propuestas a partir del documento conceptual.</p><Link href="/docente">Revisar los módulos como docente <ArrowRight size={16} /></Link></aside>
  </main>;
}
