import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { ArrowRight, Users } from "lucide-react";
import styles from "./adventure-catalog.module.css";

const nunito = localFont({ src: "../../public/fonts/nunito-variable.ttf", variable: "--catalog-font", display: "swap" });
const modules = [
  { id: "hello-explorer", title: "Hello, Explorer!", place: "Welcome Harbor", image: "/adventure/welcome-harbor.png", alt: "Alex y Byte junto al puerto de Welcome Harbor.", description: "Saluda, preséntate y conoce a tus compañeros." },
  { id: "my-world", title: "My World", place: "Explorer Village", image: "/adventure/explorer-village.png", alt: "Mia y Byte exploran una aldea rodeada de árboles.", description: "Descubre personas, lugares y objetos de tu mundo." },
];

export function AdventureCatalog({ administrator = false }: { administrator?: boolean }) {
  return <section className={`${nunito.variable} ${styles.catalog}`} aria-labelledby="adventure-catalog-heading">
    <div className={styles.heading}>
      <div><h2 id="adventure-catalog-heading" lang="en">English Learning Adventure</h2><p>Dos misiones. Un mundo por descubrir. <span>A1.1</span></p></div>
      {administrator && <Link className={styles.manage} href="#acceso-aventura"><Users size={18} />Administrar acceso</Link>}
    </div>
    <div className={styles.modules}>{modules.map((module, index) => <Link className={styles.module} href={`/aventura/${module.id}`} key={module.id}>
      <div className={styles.art}><Image src={module.image} alt={module.alt} fill sizes="(max-width: 700px) 100vw, 40vw" /><span>Misión {index + 1}</span></div>
      <div className={styles.copy}><h3 lang="en">{module.title}</h3><p>{module.description}</p><div className={styles.bottom}><span lang="en">{module.place}</span><span className={styles.enter}>Entrar <ArrowRight size={18} /></span></div></div>
    </Link>)}</div>
  </section>;
}
