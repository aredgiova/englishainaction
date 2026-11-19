import Link from "next/link";
export default function NotFound() { return <main className="problem-panel"><h1>No encontramos esta página</h1><p>Revisa el enlace o vuelve a tus cursos.</p><Link className="button" href="/panel">Volver al panel</Link></main>; }
