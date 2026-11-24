# English in Action

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router, TypeScript estricto, pnpm y Supabase (PostgreSQL y Auth), indicados por el usuario. API REST bajo `/api/v1`; cookies de sesión SSR.

## Users
Administración invita y matricula cuentas activas y decide quién puede entrar a English Learning Adventure. El docente crea, revisa y publica sus propios cursos y abre la aventura si tiene permiso. El estudiante practica en sus cursos matriculados y, cuando está habilitado, en las dos misiones ilustradas.

## Product Purpose
Una academia de inglés con edición privada, publicaciones inmutables y práctica persistente. El recorrido por roles separa progreso de calificación e integra el curso ilustrado con permiso individual.

## Operating Context
Interfaz en español, contenido didáctico en inglés; uso en escritorio y móvil. Cursos para públicos escolar, universitario y profesional. Ejemplo ficticio local: First Conversations, A1 universitario, una unidad y dos lecciones originales. Zona horaria de referencia: America/Bogota.

## Capabilities and Constraints
La academia incluye invitación por correo, acceso y recuperación de contraseña, edición de árbol completo con revisiones, publicación validada, matrícula, lectura y corrección de opción única. Los borradores admiten información incompleta. Las soluciones de los cursos de evaluación permanecen privadas. Un intento válido completa una lección incluso si contiene errores. Los reenvíos idénticos conservan un único intento.

La aventura es práctica guiada con feedback, modelos y progreso por cuenta; no es un examen. Los profesores deben validar objetivos y materiales antes de utilizarlos con estudiantes reales.

## Brand Commitments
Nombre: English in Action. Textos de la aplicación claros y en español; las actividades y diálogos, en inglés. English Learning Adventure incorpora las referencias narrativas y gráficas aportadas por el usuario y dos ilustraciones originales. El mismo mundo ilustrado recibe al usuario en acceso, recuperación y definición de contraseña y aparece en las tarjetas de misión de los tres paneles. El resto de la academia conserva su identidad operativa.

## Evidence on Hand
Especificación extensa aportada por el usuario para la academia. Todo dato de demostración debe ser original, ficticio e idempotente. Para la aventura se aportaron dos documentos DOCX, ocho fotografías de páginas de referencia y dos imágenes anteriores; su procedencia y diferencias están documentadas en [docs/adventure-source/source-map.md](docs/adventure-source/source-map.md). No se aportaron testimonios ni métricas comerciales, ni audio o ilustraciones limpios para producción.

## Product Principles

- Cada rol encuentra su próxima tarea en el panel.
- La interfaz representa permisos y progreso persistidos por cuenta. Ocultar una tarjeta no sustituye la autorización del servidor.
- El progreso mide finalización; la calificación de los cursos de evaluación mide aciertos.
- Los cambios de borrador no alteran lo publicado.
- La autorización se verifica en servicios y en la base de datos.

## Open Decisions
Sigue pendiente seleccionar el primer grupo de grados, adaptar lectura y presentación por edad y validar curricularmente My World. El estado de publicación de esta entrega se registra en el informe de verificación de acceso.

## Adventure Extension
El alcance interpreta los dos módulos solicitados como las primeras misiones A1.1 de The Discovery Islands: **Hello, Explorer!**, en Welcome Harbor, y **My World**, en Explorer Village. La primera adapta catorce pantallas detalladas; la segunda desarrolla ejemplos y actividades originales a partir del esquema conceptual y requiere validación docente.

El curso en `/aventura` requiere sesión y autorización. Permite explorar 23 paradas, escuchar con la voz del dispositivo, responder preguntas de opción única, repetir, ensayar oralmente y comparar un texto propio con un modelo. El servidor guarda las paradas completadas por cuenta y misión, recuperables desde otra sesión o dispositivo. Los textos se borran al cambiar de parada y no se envían a la aplicación; no se graba el micrófono ni se guardan ensayos orales o calificaciones. Las llaves son recompensas narrativas por recorrer las actividades.

Administración siempre puede abrir la aventura con su cuenta activa. Docentes y estudiantes requieren una cuenta activa y el permiso que administración gestiona en «Quién puede entrar». La activación inicial elegida habilita únicamente a los docentes y estudiantes activos al aplicar la migración; las cuentas posteriores necesitan habilitación manual. El permiso cubre ambas misiones y retirarlo conserva el avance.

Las dos tarjetas ilustradas aparecen en `/administracion` y, con permiso, en `/docente` y `/campus`. La aventura no requiere importar un borrador, publicar ni matricular en el motor de cursos genéricos. El antiguo botón docente de clonación se retiró; los cursos de autoría conservan su editor, publicación y matrícula independientes.

La implementación y límites están en [docs/aventura.md](docs/aventura.md), y los resultados actuales en [docs/verificacion-acceso-2026-11-24.md](docs/verificacion-acceso-2026-11-24.md). El [informe anterior](docs/verificacion-aventura-2026-11-24.md) conserva evidencia histórica del laboratorio y la plantilla; no describe el acceso vigente. Siguen pendientes juegos de arrastre y escenas interactivas, audios interpretados y adaptación por grado. No se incorporó Moodle ni una evaluación validada de las cuatro habilidades.
