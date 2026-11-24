import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { Compass, ArrowUpRight } from "lucide-react";
import styles from "@/components/adventure/adventure.module.css";
import { getMe } from "@/lib/services";
import { requireAdventureAccess } from "@/lib/adventure-access";
import { pageProblem } from "@/components/page-problem";
import { AdventureSession } from "@/components/adventure/adventure-session";
import type { Profile } from "@/lib/contracts";

const nunito = localFont({ src: "../../../public/fonts/nunito-variable.ttf", variable: "--adventure-font", display: "swap" });
export const metadata: Metadata = { title: "English Learning Adventure", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";
export default async function AdventureLayout({ children }: { children: React.ReactNode }) {
  let me: Profile;
  try { me = await getMe(); await requireAdventureAccess(); }
  catch (error) { return pageProblem(error); }
  return <div className={`${nunito.variable} ${styles.world}`}>
    <a className="skip-link" href="#adventure-content">Saltar al contenido</a>
    <header className={styles.header}>
      <Link className={styles.logo} href="/aventura" aria-label="English Learning Adventure, inicio"><Compass size={31} strokeWidth={1.7} /><span>English<span>Learning Adventure</span></span></Link>
      <nav aria-label="Navegación de aventura"><Link href="/aventura#missions">Las misiones</Link><Link href="/aventura#guide">Cómo jugar</Link><Link className={styles.academyLink} href="/panel">Ir a la academia <ArrowUpRight size={16} /></Link></nav>
    </header>
    <AdventureSession me={me} />
    {children}
    <footer className={styles.footer}><span>English in Action · The Discovery Islands</span><span>A1.1 · Aprende a tu ritmo</span></footer>
  </div>;
}
