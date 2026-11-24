import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import { Compass } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./auth.module.css";

const nunito = localFont({ src: "../../public/fonts/nunito-variable.ttf", variable: "--auth-font", display: "swap" });

/**
 * THESIS: Enter the academy through the same illustrated world as its lessons.
 * OWN-WORLD: Welcome Harbor, Nunito, deep teal, clear surfaces and an amber action.
 * STORY: Recognize the adventure, enter account details, resume the correct role.
 * FIRST VIEWPORT: A large scene beside a quiet form; compact artwork above it on mobile.
 * FORM: User-pinned adventure identity extended to the existing access flow.
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return <div className={`${nunito.variable} ${styles.shell}`}>
    <a className="skip-link" href="#access-form">Saltar al formulario</a>
    <header className={styles.header}>
      <Link href="/ingresar" className={styles.brand} aria-label="English in Action, inicio">
        <Compass aria-hidden="true" size={39} strokeWidth={1.7} />
        <span>English<span>in Action</span></span>
      </Link>
    </header>
    <aside className={styles.scene} aria-label="El mundo de English Learning Adventure">
      <Image src="/adventure/welcome-harbor.png" alt="Alex y Byte te dan la bienvenida en el puerto de las islas de aventura." fill sizes="(max-width: 760px) 100vw, 58vw" preload className={styles.artwork} />
      <div className={styles.sceneCopy}>
        <p lang="en">Hello,<br />explorer!</p>
        <span>Un mundo por descubrir.</span>
      </div>
    </aside>
    <main id="access-form" className={styles.main}>{children}</main>
  </div>;
}
