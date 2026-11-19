"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <main className="problem-panel"><h1>No pudimos cargar esta página</h1><p>Vuelve a intentarlo. Si el problema continúa, contacta con la administración.</p><button className="button" onClick={reset}>Volver a intentar</button></main>; }
