# English in Action · fase 1

Academia en español con contenido original en inglés. Next.js App Router, TypeScript estricto, pnpm y Supabase PostgreSQL/Auth. El alcance implementado es invitación, sesión y recuperación, autoría de borradores, publicación inmutable, matrícula, lectura y corrección persistente. `FASE_ACTIVA = 1`; audio, informes y grupos pertenecen a fases posteriores.

## Despliegue manual en Vercel

Repositorio: [aredgiova/englishainaction](https://github.com/aredgiova/englishainaction), rama `main`. Sigue la [guía de Vercel](docs/vercel.md): importación, cuatro variables de aplicación, dominio HTTPS y retornos de Supabase. `vercel.json` fija Next.js, instalación con lockfile y pnpm 11.25.0; `package.json` fija Node 24. Los despliegues automáticos por push están desactivados para conservar el despliegue manual solicitado.

El código incluye frontend y API en el mismo proyecto. Las migraciones ya están aplicadas en el Supabase de pruebas. La configuración privada se añade en Vercel antes de compilar. SMTP y la aceptación por correo siguen pendientes según [VERIFICACION.md](docs/VERIFICACION.md).

## Continuar con el proyecto alojado de pruebas

La configuración privada de esta entrega apunta a **Englishinaction** (`gpixjzkfovepghpdiikp`) y al origen **http://127.0.0.1:3002**. Las migraciones 001 y 002 están aplicadas. Sigue la [guía alojada](docs/supabase-hosted.md) y consulta los resultados y pendientes reales en [VERIFICACION.md](docs/VERIFICACION.md). Las credenciales permanecen en archivos de entorno ignorados; no se incluyen en este documento.

```powershell
pnpm build
pnpm start --port 3002
```

El entorno local Docker descrito abajo es independiente. Prepáralo en otra copia con variables de loopback; conserva antes la configuración alojada. La semilla y las suites locales rechazan destinos remotos. El envío de invitaciones y recuperación por correo alojado requiere completar SMTP y las plantillas indicadas en la guía.

## Arranque local

Requisitos: Node.js **24.x**, pnpm **11.25.0** y Docker Engine activo. La versión de Node queda alineada con Vercel y las pruebas de esta entrega mediante `engines` y `.nvmrc`. En Windows, instala Docker Desktop con WSL2; si Windows solicita un reinicio, complétalo antes de iniciar Supabase. El CLI Supabase está fijado como dependencia del proyecto.

```powershell
pnpm install --frozen-lockfile
pnpm db:start
pnpm demo:seed
pnpm dev
```

Abre **http://127.0.0.1:3000**. Usa ese origen de forma consistente: `localhost` y `127.0.0.1` son orígenes diferentes. `pnpm db:start` inicia Supabase, aplica las migraciones al crear su base y escribe `.env.local` con las claves locales si todavía no existe. Nunca reemplaza un archivo de entorno existente. Si ya tienes una base iniciada con una migración anterior, aplica las nuevas con `pnpm exec supabase migration up`. CLI 3.2.0 apunta al entorno local por defecto; no necesita el antiguo flag `--local`. No uses `db:reset` para actualizar datos que quieras conservar.

Si el CLI no exporta automáticamente las claves, copia `.env.example` a `.env.local` y completa los valores desde `pnpm exec supabase status`. Las claves privilegiadas son exclusivamente de servidor. La aplicación puede mostrar la pantalla de acceso sin entorno configurado, pero los datos y el acceso por roles requieren Supabase real.

Si `pnpm exec supabase` falla al resolver el ejecutable en este entorno, usa la misma versión instalada mediante `node node_modules/supabase/dist/supabase.js`, seguida del subcomando; por ejemplo, `node node_modules/supabase/dist/supabase.js migration up`. Para un proyecto alojado sigue la [guía de integración alojada](docs/supabase-hosted.md), que identifica expresamente el destino con `--remote` y conserva el historial de migraciones.

| Variable | Uso y configuración |
| --- | --- |
| `APP_URL` | Origen exacto de la aplicación y de las escrituras con cookies; local: `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la API Supabase del entorno evaluado; local: `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publicable `sb_publishable_…` o `anon` heredada compatible de ese mismo entorno; vacía en el ejemplo |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privilegiada exclusivamente de servidor, para invitaciones y aprovisionamiento; vacía en el ejemplo |
| `DATABASE_URL` | Conexión PostgreSQL administrativa para semilla/verificaciones locales o bootstrap puntual del proyecto seleccionado; fuera del navegador y del proceso web ordinario |
| `DEMO_PASSWORD` | Contraseña de identidades ficticias creadas por la semilla; no utilizar con personas reales |
| `E2E_BASE_URL` | URL del servidor que prueba Playwright; debe compartir origen con `APP_URL` |
| `MAILBOX_URL` | Buzón Mailpit local para invitación/recuperación; local: `http://127.0.0.1:54324` |
| `PLAYWRIGHT_CHANNEL` | Opcional, navegador instalado para las pruebas, por ejemplo `chrome`; si se omite usa Chromium de Playwright |

No guardes valores reales en `.env.example`. Completa `.env.local` fuera de Git y vuelve a compilar si cambias variables públicas de un build de producción.

| Servicio | Dirección local |
| --- | --- |
| Aplicación | http://127.0.0.1:3000 |
| Supabase API | http://127.0.0.1:54321 |
| PostgreSQL | 127.0.0.1:54322 |
| Supabase Studio | http://127.0.0.1:54323 |
| Buzón de prueba | http://127.0.0.1:54324 |

`pnpm db:stop` detiene Supabase conservando sus volúmenes. `pnpm db:reset` borra los datos locales y reaplica las migraciones; vuelve a ejecutar la semilla solo si deseas reconstruir la demostración desde cero.

## Acceso por rol y demostración

El acceso consulta el perfil verificado y abre `/campus` para estudiantes, `/docente` para docentes y `/administracion` para administración. `/` y `/panel` resuelven ese mismo destino en el servidor. Abrir el panel de otro rol devuelve a la ruta propia; la API conserva sus comprobaciones de permisos.

El acceso es solo por invitación. El entorno local desactiva el registro público con `enable_signup = false`; configura también esa restricción en Supabase alojado y mantén desactivadas las sesiones anónimas. Ocultar un formulario de registro no reemplaza esta configuración de Auth.

| Ruta de interfaz | Función |
| --- | --- |
| `/ingresar`, `/recuperar-clave`, `/definir-clave` | Acceso, recuperación y aceptación del correo |
| `/campus` | Siguiente lección y avance vigente; Comenzar, Continuar o Repasar |
| `/docente` | Crear cursos y distinguir borrador de publicación |
| `/administracion` | Invitaciones, matrícula y catálogo interno |
| `/cursos/{courseId}` | Índice publicado del estudiante matriculado |
| `/cursos/{courseId}/lecciones/{lessonId}` | Lectura, práctica y feedback posterior a la entrega |
| `/cursos/{courseId}/editar` | Borrador, previsualización y confirmación de publicación |

La [guía docente](docs/guia-docente.md) explica la demostración desde un curso nuevo. La previsualización utiliza el borrador local y no registra intentos. Ante una sesión caducada al guardar o entregar, la pantalla conserva el trabajo y permite volver a ingresar con la misma cuenta.

La contraseña inicial de las cuentas ficticias es el valor de `DEMO_PASSWORD` en `.env.local`; el ejemplo local usa `EnglishAction!2026`.

| Rol | Correo | Estado inicial |
| --- | --- | --- |
| Administración | admin@englishinaction.test | Invita estudiantes/docentes y matricula |
| Docente | docente@englishinaction.test | Autora de First Conversations |
| Estudiante | estudiante@englishinaction.test | Matriculada; 0 de 2 lecciones |
| Estudiante | sinmatricula@englishinaction.test | Sin cursos ni acceso a las lecciones |

`pnpm demo:seed` crea las identidades con Auth Admin y asigna sus roles en `profiles` utilizando la clave privilegiada local. Así se provisiona el primer administrador sin permitir elevaciones desde el navegador. La semilla solo acepta una URL de Supabase de loopback, conserva las contraseñas de cuentas existentes y no reemplaza publicaciones ni borra intentos. Las ejecuciones posteriores conservan el avance que ya exista. Cambiar `DEMO_PASSWORD` no restablece una cuenta ya creada; usa recuperación o reinicia expresamente la base de demostración.

**First Conversations** es A1 para universitarios, con una unidad y las lecciones **Introducing yourself** y **Introducing a classmate**. Cada una incluye diálogo original, objetivo observable, actividad obligatoria de opción única y devolución para acierto y error. El docente debe validar los objetivos y el material antes de usarlos con estudiantes reales.

1. Entra como docente. Crea otro curso o abre **Editar borrador**, añade una unidad y dos lecciones, completa objetivos, diálogos, opciones, solución y ambos comentarios. Guarda, usa **Previsualizar como estudiante** y pulsa **Publicar curso → Confirmar publicación**. Los identificadores se mantienen al reordenar.
2. Entra como administración. Invita una cuenta con rol estudiante o docente. Abre el correo en el buzón local, acepta la invitación y define una contraseña de al menos 12 caracteres. Matricula la cuenta estudiantil activa por correo en un curso publicado.
3. Entra como `estudiante@englishinaction.test`. Abre la primera lección del ejemplo y responde **Yopal**. La nota es 1/1 y el avance es **1 de 2 (50 %)**. Una respuesta equivocada también completa la lección; su nota es independiente.
4. Sal y vuelve a entrar. El curso conserva el avance y ofrece la segunda lección. Un reintento técnico con la misma clave y cuerpo devuelve el mismo intento con HTTP 200. **Volver a practicar** crea una clave nueva y otro intento.
5. Entra como la cuenta sin matrícula y abre la URL de la lección anterior: la API devuelve 404 y la interfaz no muestra el contenido. En su panel no aparece el curso.
6. Guarda cambios en el borrador docente: la publicación vigente permanece igual. Publica otra revisión: las lecciones sin cambios mantienen `lessonVersionId`, incluso al reordenarlas. Las modificadas reciben otra versión y conservan los intentos anteriores.

## Contrato y estructura

- `docs/openapi.yaml`: OpenAPI 3.1, 16 operaciones, sesión, roles, parámetros, cuerpos, estados HTTP, ejemplos y errores.
- `src/lib/contracts.ts`: esquemas Zod y tipos compartidos; borrador incompleto y publicación completa tienen validaciones distintas.
- `src/app/api/v1`: adaptadores HTTP delgados; `/auth/confirm` verifica invitaciones/recuperación y abre `/definir-clave`.
- `src/lib/services.ts`, `repository.ts`, `supabase/`: servicios, repositorio con sesión y clientes SSR/administrativo separados.
- `supabase/migrations`: modelo, restricciones, RLS y operaciones transaccionales; soluciones publicadas y huellas en esquema privado.
- `docs/arquitectura.md`: permisos por dato, módulos, transacciones, versiones y evolución a fases 2 y 3.

Toda escritura con cookies exige `Origin` igual a `APP_URL`. La API devuelve `{data}` o `{error:{code,message,fieldErrors?}}`; las respuestas personales usan `private, no-store`. No se envían soluciones ni comentarios de corrección al estudiante antes de entregar. Los clientes no pueden actualizar tablas directamente ni asignarse roles mediante metadatos de Auth.

## Verificación

```powershell
pnpm openapi:validate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

`pnpm test:integration` ejecuta **todas las migraciones SQL reales, en orden, en PGlite**, PostgreSQL embebido, con roles de base y contexto JWT de prueba. Verifica publicación, matrícula, corrección, reenvíos, versiones, historial, RLS y acceso directo a tablas, incluidos los metadatos privados del borrador. El esquema de Auth es una fixture: estas pruebas no sustituyen la comprobación de Supabase Auth, correo, PostgREST ni concurrencia entre conexiones reales.

Con Supabase, la semilla y la aplicación en ejecución:

```powershell
pnpm verify:local
pnpm test:e2e:journey
```

El guion de integración completa y sus límites se explican en `docs/local-verification.md`. La prueba de acceso adaptable puede ejecutarse con `pnpm exec playwright install chromium` y `pnpm test:e2e`; en este Windows también se puede usar Chrome instalado: `$env:PLAYWRIGHT_CHANNEL='chrome'; pnpm test:e2e`. La suite `test:e2e:journey` ejecuta el recorrido real por roles en escritorio y móvil; exige entorno y semilla, y falla explícitamente si faltan. No reemplaza el backend por datos simulados. Usa el mismo `PLAYWRIGHT_CHANNEL` cuando corresponda.

Para probar producción local, detén únicamente el servidor de desarrollo de este proyecto si ocupa el puerto y ejecuta `pnpm build`, seguido de `pnpm start`. Abre `/campus` en el mismo origen configurado. En otra terminal, ejecuta `pnpm test:e2e` y `pnpm test:e2e:journey`; la suite de recorrido usa el servidor existente o inicia `pnpm start`, por lo que requiere un build previo. Las cuentas y la base reales siguen siendo necesarias aunque el build termine correctamente.

Los resultados reales y pendientes de esta entrega están en **`docs/VERIFICACION.md`**. No avances a la fase 2 sin completar las comprobaciones pendientes de la fase 1.

## Correos y operación

Las plantillas en `supabase/templates` usan `{{ .SiteURL }}/auth/confirm?token_hash=…&type=invite|recovery`. `site_url`, las redirecciones exactas de `supabase/config.toml` y `APP_URL` deben coincidir. El buzón local recibe los mensajes ficticios; no se envían a personas reales.

Una invitación reserva su correo antes de llamar Auth. Si el proceso se interrumpe después del envío, una reserva puede quedar `pending`; revisa `invitations` y la identidad en Auth desde una sesión administrativa de base. Si Auth creó la identidad correcta, finaliza con `api_finish_invitation` usando la sesión del administrador que la creó. Si no existe esa identidad y el envío falló, marca la reserva como fallida mediante esa misma RPC antes de reintentar. No cambies roles basándote en información recibida del navegador.

## Paso a un piloto

Usa un servidor Node.js con `pnpm build` y `pnpm start`, HTTPS y un proyecto Supabase **de pruebas independiente**. La [guía de integración alojada](docs/supabase-hosted.md) detalla inventario, inicio de sesión de la CLI, enlace, ensayo de migraciones y aplicación incremental. Configura URL y clave pública, clave de servicio, `APP_URL`, SMTP, plantillas, retornos y registro público deshabilitado con valores exclusivos del piloto. No ejecutes la semilla ficticia ni un reset contra ese proyecto.

Para provisionar el primer administrador, aplica primero las migraciones, crea o invita una identidad controlada desde Supabase Dashboard/Auth Admin y confirma su correo. Suministra `DATABASE_URL` de forma segura solo al proceso de operación y ejecuta `pnpm admin:bootstrap '<UUID-confirmado-de-Auth>'`. El script exige UUID explícito, conexión administrativa, identidad confirmada y perfil activo; rechaza la operación si ya existe cualquier administrador y usa una transacción con exclusión concurrente. Retira la conexión administrativa del entorno de ejecución web y comprueba después el rol `admin` en `/api/v1/me` con la sesión de esa cuenta. No hay una ruta pública para promover usuarios ni se utiliza este bootstrap para agregar administradores posteriores.

Antes de abrir el piloto, toma un respaldo y restáuralo en otro proyecto aislado siguiendo el procedimiento de respaldo de Supabase, incluidas las identidades de Auth necesarias. Verifica perfiles, matrículas, publicaciones, intentos y acceso por roles tras la restauración. Registra evidencia y prueba invitación/recuperación desde el dominio HTTPS en escritorio y móvil. En fase 1 no hay archivos de Storage; desde la fase 2 incluye también los objetos privados y verifica su correspondencia con los registros de medios. El respaldo SQL no respalda por sí solo esos objetos.
