# Verificación de integración · fase 1

Fecha: **19 de noviembre de 2026**, `America/Bogota`. Alcance: **FASE_ACTIVA = 1**, integración de la academia existente con Supabase Auth y PostgreSQL. La publicación GitHub fue autorizada después de esta verificación; su preparación se registra al final del informe.

**La plataforma ya lee y escribe en Supabase alojado.** El recorrido real de navegador aprobó publicación, matrícula, entrega, reenvío, nueva práctica y reingreso móvil, con consulta independiente a PostgreSQL del mismo proyecto. El acceso por contraseña y la persistencia están verificados. El piloto sigue pendiente de correo, dominio HTTPS y aceptación operativa; la pila local Docker sigue pendiente por infraestructura.

Los informes anteriores se conservan en [verificación inicial](verificacion-inicial-2026-11-19.md) y [QA del prompt 03](verificacion-qa-2026-11-19.md). El segundo conserva SHA-256 `2B91494C817371CB96E648A5A245A032FC347F8B59871C009F83F6D13F1ECEDF`. Sus bloqueos describen el estado anterior.

## Entornos y alcance

| Entorno | Identificación |
| --- | --- |
| Repositorio | Copia de trabajo `ENGLISH IN ACTION`; sin commits ni remoto al verificar la integración |
| QA aislada | Copia independiente `qa-hosted-20261119`, fuera del repositorio |
| Aplicación integrada | Producción en `http://127.0.0.1:3002`, `APP_URL` coincidente; servicios existentes de 3000 y 3001 conservados |
| Supabase | **Englishinaction**, `gpixjzkfovepghpdiikp`, organización **MacheCorp** (`itzmwapdktvtdmtdddpq`), `us-east-1`, Free, PostgreSQL 17.12 |
| Propósito | Desarrollo y aceptación. La CLI denomina `production` a la rama principal alojada; no significa que la academia esté aprobada para usuarios reales |
| Inventario previo | Cero usuarios Auth, tablas de aplicación y migraciones; no había datos de academia que sobrescribir |
| Runtime | Node **24.22.3**, pnpm **11.25.0**, Supabase CLI **3.2.0**, Next **16.4.6** |

Lockfile intacto: SHA-256 `A4AF05BADE59796759BC10680C6BBD9420FBB4366FC5F35773FE5DA51D828BDB`. No se instalaron Docker ni otra versión global de Node. No se ejecutaron resets remotos, reparaciones del historial, carga masiva alojada ni publicación Git.

## Migraciones y preservación

| Versión | Base desechable PGlite | Supabase alojado |
| --- | --- | --- |
| `202611190001_phase1.sql` | Instalación limpia aprobada | Aplicada por CLI el 19-11-2026 |
| `202611190002_private_course_metadata.sql` | Instalación limpia y actualización con datos aprobadas | Aplicada por CLI el 19-11-2026 |

No se alteraron las migraciones existentes ni se añadió otra migración SQL. Se contrastaron tablas, relaciones, restricciones, RPC, permisos y políticas con las operaciones de las pantallas y OpenAPI. Perfiles ligados a Auth, autoría, borradores, publicaciones, versiones, matrículas únicas e intentos versionados corresponden al contrato. Corrección, respuesta y avance se guardan atómicamente; la misma clave y solicitud recuperan la respuesta original.

Secuencia ejecutada con salida 0 usando `node node_modules/supabase/dist/supabase.js` y `--remote=gpixjzkfovepghpdiikp` explícito:

1. `migration list`: ambas versiones locales pendientes, remoto vacío.
2. `db push --dry-run --skip-vault`: exactamente 001 y 002, sin semilla ni roles adicionales.
3. `db push --skip-vault --yes`: ambas aplicadas.
4. `migration list`: versiones locales/remotas alineadas.
5. `db push --dry-run --skip-vault`: `upToDate=true`, lista vacía.

`tests/migration-upgrade.test.ts` aplica 001, crea usuarios Auth de fixture, contenido, matrícula, publicación, intento y registros privados; aplica 002 y compara filas e identificadores de once tablas. También verifica permisos corregidos, reenvío e historial tras republicar. Acredita actualización SQL con datos, no restauración de un respaldo alojado.

## Pruebas locales

| Comprobación | Resultado |
| --- | --- |
| Instalación aislada `pnpm install --frozen-lockfile` | **0**, 421 paquetes; primer intento limitado por red, repetición autorizada completada |
| `pnpm openapi:validate` / lanzador instalado equivalente | **0**, OpenAPI 3.1 válido, 14 rutas |
| Typecheck y lint / lanzadores instalados equivalentes | **0**, sin errores |
| Vitest instalado | **83/83**, siete archivos: 45 contrato, 14 base, 3 actualización, 8 bootstrap, 7 HTTP, 2 Auth, 4 cliente |
| `pnpm build` en QA aislada | **0**, compilación, tipos y rutas |
| `pnpm start --port 3002` | Servidor iniciado con configuración real de Supabase |
| Pila Supabase local, semilla dos veces y correo local | **Pendiente**: Docker/Podman no disponibles; no se utilizó semilla remota como sustituto |

PGlite ejecuta SQL PostgreSQL con Auth/JWT de fixture. No acredita correo, contención entre conexiones remotas ni una pila Supabase local. Las pruebas HTTP con sustituciones se distinguen del recorrido real alojado.

## Auth y aprovisionamiento

Sesión CLI autenticada y comprobada mediante `projects list`; token fuera del repositorio. URL y clave publicable pertenecen al proyecto seleccionado. La clave administrativa se obtuvo directamente mediante esa sesión y se guardó en `.env.local` ignorado, sin imprimirla. El cliente privilegiado sigue limitado al servidor y operaciones administrativas concretas; las operaciones personales usan `auth.getUser()`, cookies SSR y RPC con actor/rol verificado en base.

El perfil mínimo `supabase/hosted/supabase/config.toml` se revisó con `config diff` y se aplicó con `config push --workdir supabase/hosted`. Cambios: Site URL `http://127.0.0.1:3002`, dos retornos exactos (`/auth/confirm`, `/definir-clave`), registro público deshabilitado y contraseña mínima de 12 caracteres. Anónimos deshabilitados y confirmación de correo habilitada ya coincidían. Comparación posterior: **cero propiedades declaradas pendientes**, ocho propiedades remotas no declaradas conservadas.

**Correo pendiente:** el proveedor rechazó las plantillas con `400 entitlement_required`: el proyecto Free con correo predeterminado requiere SMTP propio o un plan elegible para modificarlas. No se cambió el plan. El perfil aplicado excluye plantillas; `supabase/hosted/email-templates.toml.example` y sus HTML permiten añadirlas tras configurar SMTP. No se considera probada la recepción de invitaciones ni recuperación por buzón.

Se crearon cuatro identidades ficticias controladas de `example.invalid`: un administrador, un docente y dos estudiantes. Auth Admin confirmó sus correos administrativamente, sin enviar mensajes. Contraseña aleatoria y configuración de ejecución permanecen en `.env.hosted-test.local`, ignorado. Esto no acredita posesión de buzón.

El primer administrador se promovió con SQL privado ejecutado por la CLI: UUID explícito, privilegio administrativo, identidad confirmada, perfil activo, transacción, bloqueos asesor/de perfiles y rechazo si ya existía un administrador. **La segunda ejecución fue rechazada con `Admin already exists`**, sin cambios. `scripts/bootstrap-admin.ts` aplica las mismas restricciones con conexión PostgreSQL administrativa y dispone de ocho pruebas. No existe endpoint público de bootstrap. Solo la cuenta docente ficticia recibió ese rol.

## Aceptación alojada

La suite `test:e2e:hosted` exige proyecto, origen 3002 y cuatro cuentas ficticias distintas. No crea usuarios ni envía correos; crea un curso de aceptación y conserva sus datos. Traces, vídeo y capturas automáticas de fallo están deshabilitados para evitar guardar credenciales. **Resultado: 1/1 aprobado, salida 0, 23,4 segundos**, con Node 24 y Chrome, mediante `node node_modules/@playwright/test/cli.js test --config playwright.hosted.config.ts`.

| Recorrido real | Resultado observado |
| --- | --- |
| Docente entra y crea curso por formularios | Un curso A1, una unidad, dos lecciones con actividad obligatoria; guardar, previsualizar y publicar aprobados |
| Administración matricula | Una matrícula persistida para el estudiante previsto |
| Primera entrega | HTTP 201; nota 0/1, feedback visible y avance independiente **1/2 = 50 %** |
| Reenvío idéntico | HTTP 200, mismo identificador y respuesta original; permanece un intento |
| Volver a practicar | HTTP 201, otro identificador, nota 1/1; dos intentos y una sola lección completada |
| Salir y entrar en otro contexto móvil | Contexto nuevo sin cookies/storage previos; mismo usuario, avance 1/2 y Continuar abre la segunda lección |
| Estudiante sin matrícula | Curso ausente del catálogo, outline/lección 404, sin contenido ni opciones de actividad en pantalla |
| Consulta independiente por el conector SQL | Confirma un curso, una matrícula, dos versiones y dos intentos; sus respuestas conservan avance 1/2 y siguiente lección |

Identificadores de evidencia (no credenciales): curso `5bcb6ff4-a3d2-42d3-8d5f-a266d9c5a1ee`; publicación `e77b7f7e-16c9-4882-9ecc-f0ccf0bbfc19`; intentos `a2c0ad80-4e75-4bfd-be16-164e77c7e6ab` y `7c26a301-91c8-44dc-bedd-ae830cae61c5`; siguiente lección `c15813a2-e5ae-428f-8044-bc253b9cd1b0`. Se conservaron los datos de aceptación.

Capturas inspeccionadas: [feedback en escritorio](evidencia/hosted-desktop-feedback.png), [campus móvil tras reingresar](evidencia/hosted-mobile-campus.png) y [segunda lección móvil](evidencia/hosted-mobile-next-lesson.png). Sin desbordamiento horizontal en 1440 y 390 px. Contienen únicamente la identidad ficticia.

La primera ejecución quedó esperando un selector exacto de etiqueta de un `select`, antes de crear contenido; se interrumpió. Un intento acotado reprodujo el fallo. Se corrigieron los selectores a rol accesible `combobox`, se añadieron límites de espera y se verificó que los intentos previos no habían creado cursos. La ejecución final creó el único curso indicado. Se corrigieron los tres selectores equivalentes de la suite local sin retirar sus guardas. No fue un fallo del backend.

La prueba adicional de recuperación con cambio temporal y restauración de contraseña de la cuenta ficticia fue bloqueada por revisión automática de aprobación, al requerir autorización explícita para ese cambio concreto. No se generaron enlaces ni se cambiaron contraseñas. Se dejó la solicitud puntual al propietario; no se considera aprobada ni se intentó otra vía.

## Seguridad e infraestructura

Las once tablas de aplicación tienen RLS. Los asesores posteriores notificaron dos avisos informativos de tablas privadas sin políticas (`answer_keys`, `seed_registry`) y doce advertencias de RPC `SECURITY DEFINER` ejecutables por autenticados. Son mecanismos deliberados: acceso directo revocado a tablas privadas, RPC con actor/rol, permiso de recurso y `search_path` fijo. No se presenta como análisis sin avisos. La prueba con JWT real se registra separadamente.

**Auditoría alojada con JWT reales: aprobada**, salida 0, `2026-11-19T19:04:51Z`. [Resultado saneado](evidencia/hosted-security.json):

| Acceso directo / concurrencia | Resultado |
| --- | --- |
| Auth y perfil de las cuatro cuentas | 4/4 autenticaciones reales y roles correctos |
| Estudiante matriculado | `courses` y `drafts`: 0 filas; publicación: 1; versiones: 2, sin soluciones; matrícula: 1; intentos propios: 2 |
| Estudiante sin matrícula | 0 filas en las siete tablas comprobadas; RPC outline rechazado |
| Funciones docentes/administrativas como estudiante | Dominio 403; PostgREST transporta `P0001` como HTTP 400, adaptador Next conserva el contrato 403/404 |
| Anónimo | Siete tablas y RPC rechazados: HTTP 401 / `42501` |
| Claves privadas | Esquema `private` no expuesto: HTTP 406 / `PGRST106` para ambos estudiantes |
| Dos reenvíos simultáneos reales | HTTP 200/200, `created=false`, mismo intento y respuesta original; cantidad de intentos **2→2** |
| Estado posterior | Siete tablas idénticas antes/después; avance **1/2** y siguiente lección conservados |

Esta concurrencia comprueba dos reenvíos de un intento ya persistido. No se atribuye a esta prueba una carrera entre primeras entregas nuevas. La corrida usó un script de verificación temporal; se conserva su lógica en `scripts/verify-hosted-security.mjs` para repetirla con el UUID explícito de un curso de aceptación completado.

Las 56 fuentes de `src/` coinciden por SHA-256 entre la entrega y el build ejecutado. La búsqueda de los valores privados reales de servidor y contraseña de fixture no encontró coincidencias en los candidatos Git ni en los 54 recursos de `.next/static`. `.env.local`, `.env.hosted-test.local`, `.cache`, dependencias, build y resultados temporales están ignorados. Las credenciales nunca se incorporaron al índice ni al historial.

La fase 1 no requiere Storage. Audio, evidencias, grupos y rúbricas quedan fuera de alcance. El material de demostración se usa solo en pruebas; las pantallas productivas consultan la API.

## Archivos y repetición

- `scripts/bootstrap-admin.ts`, `tests/bootstrap-admin.test.ts`: administrador restringido y rechazo de reutilización.
- `scripts/verify-hosted-security.mjs`: auditoría reproducible con JWT reales, lectura y reenvíos existentes; reporte saneado.
- `tests/migration-upgrade.test.ts`: preservación de 001 a 002.
- `playwright.hosted.config.ts`, `tests/e2e/hosted.spec.ts`, `tests/e2e/journey.spec.ts`, `package.json`: aceptación alojada, selectores accesibles de pruebas y comando bootstrap; dependencias intactas.
- `scripts/seed.ts`: mensaje final corregido; conserva protección exclusiva para loopback.
- `.env.example`: variables públicas, privadas y de prueba sin credenciales alojadas.
- `supabase/hosted/`: Auth mínimo y plantillas pendientes de SMTP.
- `README.md`, `docs/local-verification.md`, `docs/supabase-hosted.md`: CLI 3, bootstrap, configuración y entornos.
- Informe actual, archivo histórico y evidencia: resultados separados de verificaciones anteriores.

Comandos en [guía alojada](supabase-hosted.md) y [guía local](local-verification.md). La misma copia queda preparada para repetir el prompt 03. Se conservan las guardas de loopback de `demo:seed`, `verify:local` y `test:e2e:journey`.

## Pendientes priorizados

| Prioridad | Acción y prueba de cierre |
| --- | --- |
| Alta · piloto | SMTP autorizado, dos plantillas y recepción/consumo real de invitación y recuperación; generar un token no basta |
| Alta · local | Docker, Supabase desechable, migraciones, semilla dos veces y comparación; `verify:local` y `test:e2e:journey` |
| Alta · despliegue | Dominio HTTPS final, origen/retornos actualizados, recompilación y aceptación; 3002 es desarrollo local con datos alojados |
| Media · operación | Restauración de respaldo en entorno distinto; procedimiento de cambio de correo, que no sincroniza automáticamente el perfil |
| Media · academia | Validación pedagógica y cuentas operativas controladas antes de matricular personas reales |
| Publicación | Autorizada posteriormente para `aredgiova/englishainaction`; preparación para Vercel registrada abajo |

## Preparación de GitHub y Vercel

El propietario autorizó publicar el proyecto en [aredgiova/englishainaction](https://github.com/aredgiova/englishainaction) y reservó el despliegue de Vercel para hacerlo manualmente. Se verificaron el repositorio vacío, su rama predeterminada `main` y el permiso de escritura antes de preparar la primera publicación.

`vercel.json` declara Next.js, instalación con pnpm 11.25.0 y lockfile congelado, compilación y despliegue automático por Git desactivado. `package.json` y `.nvmrc` fijan Node 24; `.vercel/` queda ignorado. La [guía de despliegue](vercel.md) describe las cuatro variables, el dominio HTTPS canónico, las URL de Auth y la comprobación posterior. No se cambió el proyecto alojado ni se creó un despliegue Vercel.

La revisión previa a publicación no detectó coincidencias con los valores privados reales en los archivos candidatos a Git, ni tokens o claves privadas en la búsqueda adicional. Las cinco capturas contienen únicamente datos ficticios. Los informes históricos se conservan como evidencia de sus respectivas verificaciones. Las credenciales reales, cachés, dependencias y builds permanecen excluidos.

Validación final en la copia limpia `qa-vercel-20261119`, sin variables privadas ni conexión a Supabase: **instalación exacta de `vercel.json` aprobada (421 paquetes), compilación exacta aprobada, OpenAPI de 14 rutas, typecheck y lint aprobados, 83/83 pruebas en siete archivos aprobadas**, todos con salida 0. Runtime Node 24.22.3 y pnpm 11.25.0; lockfile intacto y las 56 fuentes de aplicación idénticas a la entrega. Esta comprobación acredita instalación y build reproducibles, no una ejecución en Vercel. `.gitattributes` conserva los bytes originales de migraciones aplicadas e informes históricos al publicarlos.

## Ajuste de Auth después del despliegue

El propietario desplegó la aplicación en `https://englishainaction.vercel.app`. El ingreso devolvió HTTP 503 con `setup_required` y mensaje `Falta configurar APP_URL.`; las tres cuentas ficticias se verificaron directamente con Supabase y sus sesiones de comprobación se cerraron. El acceso a través de Vercel sigue pendiente de configurar esa variable y redesplegar.

Con autorización para completar la configuración, se aplicó Site URL `https://englishainaction.vercel.app` y se añadieron sus retornos exactos `/auth/confirm` y `/definir-clave`. Se conservaron seis redirecciones preexistentes. `config push` y el diff posterior terminaron con salida 0; `update=0`, `local_only=0`, ocho propiedades remotas no declaradas intactas. Perfil y guías quedan alineados. No se modificaron usuarios, contraseñas, claves, migraciones ni SMTP.
