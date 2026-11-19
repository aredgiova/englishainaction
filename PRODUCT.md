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
Nombre: English in Action. Textos de la aplicación claros y en español; las actividades y diálogos, en inglés. No existen activos visuales previos.

## Evidence on Hand
Especificación extensa aportada por el usuario; repositorio nuevo. Todo dato local de demostración debe ser original, ficticio e idempotente. No se aportaron testimonios, métricas comerciales ni fotografías.

## Product Principles
- Cada rol encuentra su próxima tarea en el panel.
- La interfaz representa el estado persistido; no simula acceso ni progreso.
- El progreso mide finalización; la calificación mide aciertos.
- Los cambios de borrador no alteran lo que está publicado.
- La autorización se verifica en servicios y en la base de datos.

## Open Decisions
Suposición de implementación: diseño operativo sobrio con navegación consistente y fuentes del sistema. No se fijó una identidad visual adicional ni un despliegue de producción.
