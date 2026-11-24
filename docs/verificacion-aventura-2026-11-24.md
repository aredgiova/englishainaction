# Verificación de los módulos de aventura

Fecha: 24 de noviembre de 2026.

## Contenido y persistencia

La revisión utiliza el contenido real de `src/lib/adventure-content.ts` y la plantilla de `src/lib/adventure-templates.ts`, no únicamente ejemplos mínimos del importador.

| Comprobación | Resultado |
| --- | --- |
| Dos módulos de nivel A1 para público escolar | Conforme al contrato de publicación |
| Hello, Explorer! / My World | 14 / 9 paradas |
| Preguntas de selección | 48 / 30; 78 en total |
| Plantilla del editor docente | 2 unidades, 16 lecciones, 78 actividades |
| Escenas y ejercicios de producción | Las 23 paradas se conservan como bloques de texto, incluidos guiones de escucha y modelos de habla y escritura |
| Opciones y respuestas | Índices válidos y respuesta correcta conservada al convertir cada actividad |
| Ilustraciones | Ambos archivos locales existen y tienen descripción alternativa |
| Guardado del contenido real | PostgreSQL acepta la creación del curso y el guardado íntegro de la plantilla; el curso permanece sin publicación automática |
| Publicación y práctica | Publicación en base aislada, matrícula ficticia y corrección satisfactoria de las 78 respuestas, con avance final 16/16 |
| Soluciones de evaluación | Las lecciones recuperadas como estudiante no contienen claves de respuesta ni feedback reservado |

La prueba de publicación y calificación ejecuta las migraciones y las funciones del proyecto en PostgreSQL embebido (PGlite), con usuarios y contexto de autenticación ficticios. Una prueba adicional de navegador verificó el inicio de sesión y el botón docente reales contra Supabase remoto, usando cuentas de prueba existentes.

## Comandos ejecutados

| Comando | Resultado |
| --- | --- |
| `pnpm test` | 9 archivos y 93 pruebas aprobadas |
| `pnpm test:integration` | 3 archivos y 26 pruebas aprobadas |
| TypeScript | Aprobado |
| ESLint | Aprobado |
| Compilación de producción | Aprobada |
| `pnpm test:e2e:adventure` | 3 pruebas aprobadas: recorrido de ambas misiones, presentación en escritorio/móvil y controles de voz con recuperación de errores |
| `pnpm test:e2e:adventure:hosted` | 1 prueba aprobada en 17,6 s, contra el servidor local de producción y Supabase remoto con cuentas ficticias |

La suite de integración ya está incluida en `pnpm test`; sus 26 pruebas no se suman a las 93.

La verificación de producción y navegador utilizó Node.js 24 del entorno disponible y `PLAYWRIGHT_CHANNEL=msedge`. Para la prueba autenticada se inició `next start` en `127.0.0.1:3002` con la configuración de pruebas alojadas; el proceso se detuvo al finalizar. Las credenciales no forman parte de este informe ni de los archivos versionados.

La revisión corrigió dos problemas: la práctica oral ahora permite escuchar su propio modelo, y el feedback español hereda el idioma de la página para lectores de pantalla. La prueba de controles de voz usa una implementación simulada de la API del navegador; verifica las interacciones y los errores, no la calidad acústica de las voces instaladas.

El recorrido autenticado dedicado creó un borrador nuevo de aventura desde la interfaz docente y comprobó sus dos unidades, dieciséis lecciones, contenido completo y revisión 2 persistida. Verificó que reabrirlo no duplicara el curso, la vista previa con teclado y a 390 px, y la denegación 403 al intentar consultar ese borrador como estudiante. Al terminar eliminó exclusivamente el borrador creado por la prueba, comprobando su identificador, propietario y estado sin publicar. No publicó el curso ni modificó cursos institucionales.

## Alcance y límites

La suite general `playwright.journey.config.ts`, que incluye invitaciones, recuperación por correo y todo el ciclo docente/administrador/estudiante, no se ejecutó: requiere PostgreSQL, Supabase y buzón locales que no están disponibles en este entorno. El recorrido autenticado de aventura sí quedó verificado mediante la prueba dedicada descrita arriba. No se realizó un despliegue web; la compilación de producción se sirvió localmente para la prueba.

El laboratorio público y la plantilla docente son experiencias diferentes. El laboratorio ofrece ilustraciones, voz del dispositivo y progreso local del recorrido. El formato persistente actual de la academia admite texto y selección de respuestas; los guiones se conservan, pero no se trasladan imágenes ni controles de audio. Las producciones orales y escritas requieren revisión humana.

My World sigue siendo una propuesta curricular desarrollada desde el esquema conceptual. Los juegos de arrastrar, ordenar e interactuar con escenas, los audios grabados y la evaluación de las cuatro habilidades siguen pendientes, según `docs/aventura.md`. La aprobación de las pruebas técnicas no sustituye esa validación pedagógica.
