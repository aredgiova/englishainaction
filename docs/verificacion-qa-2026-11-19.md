# Verificación técnica y entrega · fase 1

Fecha: **19 de noviembre de 2026**, segunda pasada, `America/Bogota` (UTC−05:00). Alcance declarado: **FASE_ACTIVA = 1**. Solo se considera verificado el entorno local descrito aquí.

## Dictámenes independientes

| Ámbito | Estado | Dictamen |
| --- | --- | --- |
| Funcionamiento local completo | **bloqueado** | Instalación aislada, contrato, tipos, lint, 72 pruebas, build, arranque de producción y dos pruebas públicas de navegador aprobados. Falta ejecutar Auth, correo, PostgREST y el circuito por roles con Supabase real. |
| Integración con Supabase alojado | **bloqueado** | No se proporcionó ni conectó un proyecto alojado. No se aplicaron migraciones remotas ni se probaron sus cuentas, correo, dominio o permisos efectivos. |
| Preparación del código para subir después a GitHub | **aprobado** | Código, lockfile, ambas migraciones, pruebas y documentación disponibles para revisión local; exclusiones verificadas y sin secretos reales identificados. Esta aprobación permite revisar/subir código, no abrir el piloto. No se creó commit, remoto, repositorio remoto ni push. |

## Resultado inicial y cambios de esta segunda pasada

El [informe inicial](verificacion-inicial-2026-11-19.md) se conserva íntegro. SHA-256 antes y después de archivarlo: `B19891EC0E2C4C4E330DDF3C4DCDC810A05BC4F3A9904A7E3EA3EA9CB0F6F9A3`. Registraba 70 pruebas y dos pruebas públicas de navegador sobre desarrollo, con el recorrido autenticado bloqueado. Su referencia a Node 22.15 describe aquella ejecución; esa versión no satisface todos los requisitos del lockfile actual.

**No hubo una integración nueva con Supabase entre ambas pasadas.** Sigue faltando el servicio y su configuración. Esta segunda pasada añade una instalación aislada compatible, producción local, auditoría del flujo de datos, dos regresiones y una corrección de RLS. La cantidad final es 72 pruebas: 45 de contrato, 14 de PostgreSQL, 7 HTTP, 2 de recuperación y 4 del cliente HTTP. Las dos pruebas públicas de Playwright se cuentan aparte.

Se corrigió un fallo real: tras guardar un borrador nuevo, un estudiante matriculado podía leer por tabla directa su título, nivel y público no publicados. La API devolvía los metadatos publicados, pero exponía la revisión del borrador. La migración incremental `202611190002_private_course_metadata.sql` limita `courses` al autor/administración, conserva la lectura autorizada de publicaciones y lecciones mediante predicados seguros y devuelve al estudiante la revisión publicada. La migración original permanece intacta.

## Entorno y trazabilidad

- Origen del código: `C:\Users\User\Documents\ChatGPT\ENGLISH IN ACTION`.
- Copia aislada: `C:\Users\User\.codex\visualizations\2026\11\19\01a1f439-e920-7332-9f02-ca17fbd30345\qa-phase1-20261119`. Se copiaron los archivos candidatos según las exclusiones Git; dependencias y build se generaron allí. No se copiaron secretos ni bases del usuario.
- Windows, PowerShell, **Node 24.22.3**, **pnpm 11.25.0**, Next.js 16.4.6, Chrome instalado. Las versiones de dependencias no se cambiaron.
- El Node predeterminado del sistema es 22.15.0. Para esta verificación se antepuso solo en los procesos de prueba `C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin` a `PATH`. No se cambió la instalación del sistema.
- Lockfile sin cambios, SHA-256: `A4AF05BADE59796759BC10680C6BBD9420FBB4366FC5F35773FE5DA51D828BDB`.
- Revisión independiente de cierre: 85 archivos de fuentes, scripts, pruebas, Supabase y configuración idénticos por SHA-256 entre el árbol entregado y la copia ejecutada; contrato OpenAPI también idéntico. Las capturas publicables coinciden con las generadas en QA.
- Git ya estaba inicializado en la raíz correcta. Rama `master`, **sin commits ni HEAD**; `git rev-parse --verify HEAD` devuelve 128. Cero archivos rastreados y cero remotos al revisar. Los archivos siguen sin incorporar al índice; no existe un diff contra un commit base.
- Docker/Podman no disponibles, `.env.local` ausente, sin Supabase local utilizable. No se ejecutó `db:reset`, no se borraron bases ni se modificaron volúmenes existentes.
- Producción evaluada: **http://127.0.0.1:3001**. Se dejó activo el proceso de `pnpm start --port 3001` al entregar. El intento en 3000 encontró el puerto ocupado y se conservó ese servicio. El puerto alternativo solo se usó para las comprobaciones sin autenticación; para el circuito Auth debe coincidir el origen de aplicación, Auth, correo y pruebas.

## Comandos y resultados observados

Los comandos se ejecutaron con Node 24 en la copia aislada, salvo la reproducción inicial de regresiones y la auditoría Git del árbol de trabajo. Salida indica el código del comando principal; se anota el código de la herramienta interna cuando difiere. Un servicio que queda ejecutándose no tiene aún código de salida final.

| Comando / comprobación | Esperado | Observado / salida | Estado |
| --- | --- | --- | --- |
| `pnpm install --frozen-lockfile` | Instalar exactamente el lock | Primer intento limitado por red EACCES, interrumpido: 1. Repetición con acceso autorizado: **0**, lock vigente, 421 paquetes, esbuild completado | aprobado |
| `node --version`; `pnpm --version` | Runtime compatible, gestor fijado | 24.22.3 y 11.25.0; 0 | aprobado |
| `pnpm openapi:validate` | OpenAPI 3.1 válido | 14 rutas / 16 operaciones; 0 | aprobado |
| Nueva regresión del origen del contrato | Mismo origen en OpenAPI y ejemplo | Antes: `localhost` frente a `127.0.0.1`, salida 1 | fallido |
| `vitest run tests/contracts.test.ts` tras corrección | 45 casos válidos | 45/45; 0 | aprobado |
| `pnpm typecheck`, primera ejecución de QA | Sin errores | Dos TS2345 en la prueba nueva por variables posiblemente ausentes; pnpm 1, TypeScript 2 | fallido |
| `pnpm typecheck` tras guardas explícitas | Sin errores | 0; build volvió a comprobar tipos | aprobado |
| `pnpm lint` | Sin errores de código | 0 | aprobado |
| `pnpm exec eslint tests/contracts.test.ts` tras las guardas | Ejecutar lint focal | 1; el lanzador de este entorno no encontró `eslint` mediante `exec` | fallido |
| `node node_modules/eslint/bin/eslint.js tests/contracts.test.ts` | Repetir lint focal con el binario instalado | 0; sin errores | aprobado |
| `pnpm test:integration -t "does not expose unpublished course metadata"` antes de la migración 002 | Alumno sin metadatos de borrador | Recibió título, nivel B2 y público profesional no publicados; 1 | fallido |
| `pnpm test:integration` tras migración 002 | Ejecutar ambas migraciones, RLS y dominio | 14/14; 0. Alumno recibe publicación/revisión 1, tabla mutable vacía, contenido vigente accesible; ajeno sin filas | aprobado |
| `pnpm test` | Todas las pruebas unitarias/contrato/SQL | 72/72 en cinco archivos; 0 | aprobado |
| `pnpm build` | Build de producción y rutas válidas | Compilación webpack, TypeScript y generación de rutas completados; 0 | aprobado |
| `APP_URL=http://127.0.0.1:3000 pnpm start`¹ | Escuchar en el origen predeterminado | EADDRINUSE; 1. No se detuvo el servicio que ocupaba ese puerto | bloqueado |
| `APP_URL=http://127.0.0.1:3001 pnpm start --port 3001`¹ | Escuchar el build de producción aislado | Ready, Next 16.4.6, 165 ms; proceso activo, sin salida final | aprobado |
| Abrir `/campus` en navegador del editor | Campus o diagnóstico coherente con entorno | Página «Conecta tu academia», configuración ausente visible; no aparece información ficticia | aprobado |
| `Invoke-WebRequest` sobre `/campus`, `/ingresar`, `/api/v1/me` | Respuestas coherentes y privadas | 200, 200, 503 `setup_required`; `Cache-Control: no-store, private`; comando 0 | aprobado |
| `E2E_BASE_URL=http://127.0.0.1:3001 PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e`¹ | Acceso y recuperación adaptables sobre servidor existente | 2/2; 0. Reutilizó el servidor de producción; 1440×1000 y 390×844, sin desbordamiento | aprobado |
| `pnpm db:start` | Supabase/Docker operativo y configuración local | 1, «Docker Engine no está disponible»; no modificó datos | bloqueado |
| `pnpm exec supabase migration up --local` | Aplicar migraciones a PostgreSQL local | No ejecutado: servicio inexistente. Ambas migraciones sí se ejecutaron en PGlite; no se confunde con Supabase | bloqueado |
| `pnpm demo:seed` | Cargar cuentas y ejemplo ficticios en Supabase aislado | pnpm 1, Node 9; `.env.local` ausente antes de conectar | bloqueado |
| `pnpm verify:local` | HTTP, Auth, PostgREST, correo y concurrencia reales | pnpm 1, Node 9; `.env.local` ausente; ninguna comprobación del script ejecutada | bloqueado |
| `pnpm test:e2e:journey` | Recorrido completo en escritorio y móvil | 1 en preflight: falta `.env.local`. Ningún caso autenticado se considera aprobado | bloqueado |
| Migraciones / acceso a Supabase alojado | Validar el proyecto remoto de pruebas | No ejecutado; proyecto y configuración no suministrados | bloqueado |

¹ Notación abreviada de variables. En PowerShell se utilizaron asignaciones `$env:APP_URL='…'`, `$env:E2E_BASE_URL='…'` y `$env:PLAYWRIGHT_CHANNEL='chrome'` antes de los comandos.

Las capturas reales fueron revisadas visualmente: [escritorio](evidencia/access-1440.png) y [móvil](evidencia/access-390.png). Son pantallas de acceso sin Supabase, no evidencia de un campus autenticado. Los controles deshabilitados y el aviso de configuración son coherentes con el estado del entorno.

## Pantallas, API y procedencia de datos

La inspección estática de esta trazabilidad está **aprobada**. La ejecución autenticada completa de las filas siguientes está **bloqueada**, salvo la vista pública y la cobertura SQL separadas expresamente.

| Pantalla / acción | API y persistencia real | Datos fijos o de navegador |
| --- | --- | --- |
| Ingreso, recuperación, definición de contraseña | `auth/login`, `auth/recover`, `auth/password`, `/auth/confirm`; Supabase Auth y `profiles`, perfil verificado por servidor | Textos y placeholders; sin identidad ficticia de respaldo. Formularios deshabilitados cuando falta configuración |
| `/campus`, Comenzar / Continuar / Repasar | `api_me`, `api_courses`, `api_outline`; matrículas, publicación vigente y `attempts` | No usa almacenamiento del navegador como fuente de avance |
| `/docente`, creación y editor | `api_create_course`, `api_get_draft`, `api_save_draft`; `courses` y `drafts`, revisión optimista | `sessionStorage` conserva edición sin guardar y copias de conflicto, identificadas por actor/curso; guardar depende de API |
| Previsualización docente | Proyección saneada del borrador local | Simulación explícita y legítima; no representa una sesión estudiantil ni registra avance |
| Publicación | `api_publish`; `releases`, `lesson_versions`, `release_lessons`, claves privadas | Confirmación local; resultado persistido en PostgreSQL |
| `/administracion` | Invitaciones vía Auth y `invitations`; matrícula vía `api_enroll` y `enrollments` | Catálogo obtenido de API; listas fijas solo para etiquetas de roles |
| Curso y lección estudiantil | `api_outline`, `api_lesson`; únicamente publicación vigente autorizada | Sin contenido de demostración importado por componentes productivos |
| Entregar y Volver a practicar | `api_attempt`; corrección y respuesta persistidas en `attempts`, soluciones en `private.answer_keys` | `sessionStorage` retiene cuerpo/clave para reenvío técnico; una práctica nueva genera otra clave. La base sigue siendo la fuente de resultado/avance |
| Cierre / recuperación de sesión | Auth y cookies SSR; limpieza de copias locales del actor al salir | Conserva formulario durante 401, solicita la misma identidad y requiere reintentar la acción |

Los diálogos de `demo-content.ts` se usan en semilla y pruebas; no sustituyen respuestas de servidor. Niveles MCER, públicos, etiquetas y textos de interfaz son datos fijos legítimos. No se encontraron pantallas productivas con cursos, notas o matrículas simulados.

## Circuito de aceptación y límites de cada prueba

| Caso solicitado | Evidencia disponible | Estado del circuito completo |
| --- | --- | --- |
| Administración invita; aceptación, salida y recuperación por buzón | Guion Playwright y verificador HTTP preparados. Pruebas HTTP de recuperación simulan proveedor; SQL prueba reserva y permisos | bloqueado |
| Docente crea A1, unidad, dos lecciones obligatorias; guarda, previsualiza y publica | Publicación y validación aprobadas en SQL; recorrido por formularios preparado, sin ejecución autenticada | bloqueado |
| Administración matricula; otro alumno no accede | Matrícula única y aislamiento aprobados en SQL; 404 en adaptador HTTP con dependencia simulada | bloqueado |
| Feedback y 1/2 = 50 %, nota separada | SQL aprueba intento correcto/incorrecto y avance independiente. Verificación visual autenticada pendiente | bloqueado |
| Cierra y entra en otro contexto; Continuar abre lección 2 | Suite ampliada crea **otro BrowserContext**, sin cookies/storage, verifica el mismo perfil e intentos directamente en PostgreSQL. Código preparado, no ejecutado | bloqueado |
| Misma entrega/clave devuelve mismo intento y avance | Aprobado en SQL; cliente HTTP verifica cuerpo/clave con fetch simulado. Concurrencia con dos conexiones reales pendiente | bloqueado |
| Volver a practicar genera intento nuevo, sin duplicar lección completada | Aprobado en SQL; interacción real pendiente | bloqueado |
| Solo publicación, claves omitidas y cada alumno ve sus datos | Aprobado en SQL/RLS, incluidos SELECT directos y regresión de metadatos. PostgREST con JWT real pendiente | bloqueado |
| Editar no cambia publicación; republicar conserva intentos históricos | Aprobado en SQL. Suite de navegador ampliada verifica versiones, historial en base, replay 200 y versión desplazada 409; pendiente ejecutarla | bloqueado |
| Audio privado, transcripción, historial visible e informe docente | Pertenecen a fase 2; no entregados ni simulados | fuera de fase |
| Grupos, agenda, entregas y rúbricas | Pertenecen a fase 3; no entregados ni simulados | fuera de fase |

PGlite ejecuta PostgreSQL real y las migraciones del proyecto, pero suministra una tabla Auth de prueba y un identificador JWT de fixture. Una nueva sesión SQL no acredita una sesión Auth ni un contexto de navegador. Sus llamadas paralelas se encolan en una única conexión; no acreditan contención entre conexiones. Las pruebas HTTP con servicios sustituidos y las de cliente con `fetch` simulado acreditan solo esas capas. Ninguna de ellas acredita envío/consumo de correos o integración alojada.

## Correcciones y archivos

| Archivo | Cambio y motivo | Verificación |
| --- | --- | --- |
| `supabase/migrations/202611190002_private_course_metadata.sql` | RLS de metadatos mutables, predicados de lectura publicada y revisión publicada en `api_courses`; actualización incremental sin reset | Regresión falló antes; 14/14 SQL después |
| `tests/database.test.ts` | Ejecuta todas las migraciones ordenadas; prueba metadatos, revisión y conservación de acceso publicado | 14/14 |
| `scripts/verify-local.ts` | Añade comprobación de metadatos por API y PostgREST tras editar borrador | Tipos aprobados; ejecución real bloqueada |
| `docs/openapi.yaml`, `tests/contracts.test.ts` | Unifica origen 127.0.0.1 y añade regresión contra `.env.example`; guardas explícitas para valores ausentes | 45/45 y tipos aprobados |
| `tests/e2e/journey.spec.ts` | Contexto nuevo para reingreso, feedback visible, historial/republicación contrastados con base | Lint/tipos aprobados; ejecución real bloqueada |
| `playwright.journey.config.ts` | Arranque alternativo usa producción y puerto del origen, con build previo | Tipos/lint aprobados; preflight bloquea correctamente configuración ausente |
| `package.json` | Node compatible `^22.19.0 || ^24.0.0`; sin cambiar versiones de dependencias | Instalación aislada y build con 24.22.3 |
| `README.md`, `.env.example`, `docs/local-verification.md`, `docs/arquitectura.md` | Prerrequisitos, variables, producción, aplicación incremental y comportamiento RLS | Revisión documental |
| `docs/VERIFICACION.md`, archivo inicial y `docs/evidencia/` | Resultado actual separado de evidencia histórica, capturas sin datos personales | Revisión de entrega |

## Conjunto publicable y brecha para prompt 04

`git ls-files` confirmó cero archivos rastreados: no había secretos previamente versionados ni historial que modificar. Se revisaron los **99 archivos candidatos finales** y las exclusiones. `.env.local`, dependencias, `.next`, cobertura, informes de pruebas, logs, temporales Supabase y cachés quedan excluidos; `.env.example`, código, lockfile, migraciones y pruebas quedan incluidos. El escaneo buscó claves privadas, JWT, tokens de proveedores, credenciales literales y URLs autenticadas. Solo se identificaron ejemplos locales ficticios y fixtures de prueba. No se imprimieron credenciales reales. No se modificó `.gitignore` porque sus reglas ya cubrían esos artefactos.

La brecha de integración no es una pantalla desconectada de API: el código productivo está enlazado con servicios/RPC. Falta **ejecutar esa unión con infraestructura real**. Para prompt 04: habilitar un Supabase aislado, aplicar ambas migraciones sin resetear bases existentes, cargar la semilla solo en loopback, configurar las ocho variables descritas en README, compilar después de configurar las variables públicas y ejecutar el verificador y el recorrido completo. Debe quedar evidencia diferenciada del entorno local y del proyecto Supabase alojado. Los scripts actuales rechazan URLs remotas deliberadamente; no retirar esa protección para probar el piloto. El proyecto alojado requiere identidades y cursos de prueba provisionados específicamente y una aceptación separada en su dominio.

## Pendientes al cierre

| ID / prioridad | Impacto | Acción exacta | Responsable sugerido | Prueba de cierre | ¿Impide subir código? | ¿Impide piloto? | Fase |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 / alta | Circuito completo local sin acreditar | Activar Docker Engine; en copia aislada ejecutar `pnpm db:start`, migraciones locales pendientes, `pnpm demo:seed`, `pnpm build`, `pnpm start` en origen coincidente | Operación + QA | `pnpm verify:local` y `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e:journey` con salida 0; ambos tamaños, correo, nuevo contexto, RLS y concurrencia real | No | Sí | 1 |
| P02 / alta | Supabase alojado no integrado/verificado | Disponer proyecto de pruebas independiente; aplicar migraciones 001 y 002 sin reset; configurar variables, URLs, SMTP y plantillas; provisionar identidades ficticias específicas sin usar la semilla local remota | Backend + operación | Repetir circuito por roles y PostgREST con JWT real en dominio HTTPS, registrar proyecto/fecha sin secretos y evidencia de aislamiento | No | Sí | 1 |
| P03 / alta | Bases creadas antes de esta corrección conservan la filtración de metadatos | Aplicar migración 002 a cada entorno existente con procedimiento incremental revisado | Backend / DBA | Alumno lee publicación original vía API, revisión publicada; SELECT courses vacío; lecciones actuales accesibles; ajeno sin acceso | No | Sí | 1 |
| P04 / media | Recuperabilidad del piloto no demostrada | Respaldar proyecto y restaurar en otro entorno aislado, incluidas identidades necesarias; contrastar perfiles, matrícula, publicaciones e intentos | Operación / DBA | Restauración documentada y acceso por roles conservando historial | No | Sí | 1 |
| P05 / media | Aceptación pedagógica pendiente | Docente revisa objetivos, diálogos, opciones y explicaciones de las dos lecciones | Responsable académico | Aprobación del material antes de matricular personas reales | No | Sí | 1 |
| P06 / baja | Publicación Git reservada para después | Al recibir URL e instrucción, revisar candidatos, incorporar solo conjunto publicable y configurar remoto/commit/push según autorización | Responsable del repositorio | Revisión de cambios y secretos previa; remoto confirmado y revisión publicada identificable | No; URL no bloquea esta revisión | No por sí sola | Entrega |
| P07 / futura | Audio, historial visible e informes aún no disponibles | Implementar fase 2 después de cerrar aceptación de fase 1 | Desarrollo + QA | Pruebas de medios privados, transcripción, historial e informes | No | No para piloto de fase 1 | 2 |
| P08 / futura | Grupos, agenda, entregas y rúbricas aún no disponibles | Implementar fase 3 con ampliaciones incrementales de contrato/datos | Desarrollo + QA | Permisos por grupo y revisión de entregas con rúbrica | No | No para piloto de fase 1 | 3 |
