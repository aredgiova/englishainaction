# English in Action

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router, TypeScript estricto, pnpm y Supabase (PostgreSQL y Auth), indicados por el usuario. API REST bajo `/api/v1`; cookies de sesión SSR.

## Users
Administración invita a docentes y estudiantes y matricula cuentas activas. El docente crea, revisa y publica sus propios cursos. El estudiante practica en sus cursos matriculados y retoma la siguiente lección pendiente.

## Product Purpose
Una academia de inglés con edición privada, publicaciones inmutables y práctica persistente. La fase 1 debe permitir demostrar todo el recorrido por roles, con progreso y calificación separados.

## Operating Context
Interfaz en español, contenido didáctico en inglés; uso en escritorio y móvil. Cursos para públicos escolar, universitario y profesional. Ejemplo ficticio local: First Conversations, A1 universitario, una unidad y dos lecciones originales. Zona horaria de referencia: America/Bogota.

## Capabilities and Constraints
La fase 1 incluye invitación por correo, acceso y recuperación de contraseña, edición de árbol completo con revisiones, publicación validada, matrícula, lectura y corrección de opción única. Los borradores admiten información incompleta. Las soluciones permanecen privadas. Un intento válido completa una lección incluso si contiene errores. Los reenvíos idénticos conservan un único intento.

No añadir funciones de fases 2 y 3 antes de verificar la fase previa. Los profesores deben validar los objetivos y materiales antes de utilizarlos con estudiantes reales.

## Brand Commitments
Nombre: English in Action. Textos de la aplicación claros y en español; las actividades y diálogos, en inglés. La academia conserva su identidad operativa. La extensión English Learning Adventure incorpora las referencias narrativas y gráficas aportadas por el usuario y dos ilustraciones originales; su dirección visual se limita a `/aventura`.

## Evidence on Hand
Especificación extensa aportada por el usuario para la academia. Todo dato local de demostración debe ser original, ficticio e idempotente. Para la aventura se aportaron dos documentos DOCX, ocho fotografías de páginas de referencia y dos imágenes anteriores; su procedencia y las diferencias entre fuentes están documentadas en [docs/adventure-source/source-map.md](docs/adventure-source/source-map.md). No se aportaron testimonios ni métricas comerciales, ni audio o ilustraciones limpios para producción.

## Product Principles
- Cada rol encuentra su próxima tarea en el panel.
- La interfaz académica representa el estado persistido; no simula acceso ni progreso. La aventura pública identifica expresamente su avance como un recorrido local de prueba.
- El progreso mide finalización; la calificación mide aciertos.
- Los cambios de borrador no alteran lo que está publicado.
- La autorización se verifica en servicios y en la base de datos.

## Open Decisions
La academia mantiene el diseño operativo sobrio con navegación consistente y fuentes del sistema. La aventura tiene una dirección ilustrada propia, documentada en DESIGN.md. Sigue pendiente seleccionar el primer grupo de grados, adaptar lectura y presentación por edad y validar curricularmente My World. No se fijó un despliegue de producción.

## Adventure Extension

El alcance inicial interpreta los dos módulos solicitados como las dos primeras misiones A1.1 de The Discovery Islands: **Hello, Explorer!**, en Welcome Harbor, y **My World**, en Explorer Village. La primera adapta las catorce pantallas detalladas de la fuente; la segunda desarrolla ejemplos y actividades originales a partir del esquema conceptual y requiere validación docente.

El laboratorio público en `/aventura` permite explorar las paradas, escuchar ejemplos con la voz del dispositivo, responder preguntas de opción única, repetir, ensayar oralmente y comparar un texto propio con un modelo. Guarda solo identificadores de paradas completadas por misión en el navegador. Los textos se borran al cambiar de parada; no se graba el micrófono ni se envían ensayos o calificaciones al servidor. Las llaves y los distintivos son recompensas narrativas por recorrer las actividades.

Desde `/docente`, «Crear borrador con los dos módulos» carga un curso persistente de nivel A1 y público escolar, con dos unidades y dieciséis lecciones en el formato existente de texto y opción única. Incluye guiones y tareas de producción para revisión docente. La importación no publica ni matricula estudiantes y no transfiere las ilustraciones o interacciones multimedia del laboratorio. El docente revisa y publica mediante el editor habitual.

La implementación y sus límites están descritos en [docs/aventura.md](docs/aventura.md). Se documentaron capturas de portada y misión a 1440 y 390 px y pruebas funcionales de ambos recorridos, respuestas, recuperación, reinicio y controles de voz. La importación real se verificó desde el panel docente con una cuenta ficticia existente y Supabase remoto: se guardó el contenido completo, se comprobó que permaneciera privado y se eliminó exclusivamente el borrador creado para la prueba, sin publicarlo. Los fallos y reintentos se verificaron además con dobles de la API; no se usaron cuentas institucionales reales ni se realizó un despliegue web. Los resultados están en [docs/verificacion-aventura-2026-11-24.md](docs/verificacion-aventura-2026-11-24.md). Siguen pendientes los juegos de arrastre y escenas interactivas, audios interpretados, adaptación por grado y progreso multimedia por cuenta. No se incorporó Moodle ni una evaluación validada de las cuatro habilidades.
