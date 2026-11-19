# Integración con Supabase alojado · fase 1

Esta guía permite repetir la integración del proyecto de pruebas identificado abajo. Describe operaciones pendientes o repetibles; los resultados efectivamente ejecutados se registran por separado en [VERIFICACION.md](VERIFICACION.md). Una conexión del editor a Supabase no equivale a una sesión autenticada de la CLI ni acredita el acceso de la aplicación.

| Dato | Proyecto seleccionado |
| --- | --- |
| Nombre | Englishinaction |
| Referencia | `gpixjzkfovepghpdiikp` |
| Organización | MacheCorp · `itzmwapdktvtdmtdddpq` |
| Región | `us-east-1` |
| Plan observado | Free |
| Origen de aplicación para desarrollo integrado | `http://127.0.0.1:3002` |

El inventario inicial consultado por el conector el 19 de noviembre de 2026 encontró **cero usuarios Auth, cero tablas de aplicación y cero migraciones registradas**. Es una fotografía previa a la integración: vuelve a consultar el estado antes de repetir operaciones. No implica que los esquemas internos de Supabase estén vacíos.

En la integración posterior se autenticó la CLI y se aplicaron las migraciones **001 y 002**. La lista posterior alineó las versiones locales y remotas, y el ensayo final no encontró migraciones pendientes. También se aplicaron cuatro diferencias de Auth: Site URL, redirecciones, registro público deshabilitado y contraseña mínima de doce caracteres. Se crearon cuatro identidades ficticias mediante Auth Admin para probar la aplicación. **El correo y sus plantillas siguen pendientes**: esas identidades se confirmaron administrativamente, sin enviar correos. Los resultados de aceptación de la interfaz se registran en el informe, sin inferirlos de estos pasos de infraestructura.

## Preparación y credenciales

Trabaja desde la raíz del repositorio, con Node.js 24 y pnpm 11.25.0. Instala con el lockfile y conserva Supabase CLI 3.2.0, fijado en `package.json`.

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
node node_modules/supabase/dist/supabase.js --version
```

El último comando debe indicar `3.2.0`. La invocación directa del archivo instalado evita depender de un binario global y permite continuar si `pnpm exec supabase` falla en este entorno. No requiere instalar otra versión. Si la CLI informa un error de permisos sobre su configuración o telemetría de usuario, resuelve ese permiso local antes de interpretar el resultado como un fallo del proyecto remoto.

Mantén fuera de Git los tokens de acceso, contraseñas, cadenas de conexión y claves privilegiadas. Usa el inicio de sesión interactivo de la CLI, el gestor de credenciales o variables de proceso suministradas por un canal seguro. No pegues secretos en chat, comandos guardados, capturas o documentación. `SUPABASE_ACCESS_TOKEN` y `SUPABASE_DB_PASSWORD` pertenecen a la operación de la CLI, no a la configuración pública de Next.js. La conexión administrativa `DATABASE_URL` solo debe estar disponible durante el aprovisionamiento o la verificación que la necesite.

## Inventario y migraciones incrementales

Antes de aplicar SQL, confirma nombre, referencia, organización y región en el proyecto. Revisa usuarios, tablas de aplicación, políticas, funciones e historial de migraciones; registra cantidades y versiones, sin datos personales. Si ya existen objetos o datos, identifica su origen y prepara un respaldo recuperable antes de continuar. No supongas que el inventario inicial sigue vigente.

Las migraciones del repositorio son:

1. `202611190001_phase1.sql`: esquema inicial, permisos, políticas y operaciones de la fase 1.
2. `202611190002_private_course_metadata.sql`: restringe los metadatos mutables de `courses` y conserva la lectura autorizada de publicaciones; el alumno recibe la revisión publicada.

En CLI 3, los comandos de base apuntan al entorno local por defecto. Esta guía identifica explícitamente el remoto. Las mutaciones alojadas solicitan confirmación; revisa el destino y la lista concreta antes de aceptarla. [Cambio de CLI 3](https://supabase.com/changelog/supabase-cli-v3).

```powershell
node node_modules/supabase/dist/supabase.js login
node node_modules/supabase/dist/supabase.js link gpixjzkfovepghpdiikp
node node_modules/supabase/dist/supabase.js migration list --remote=gpixjzkfovepghpdiikp
node node_modules/supabase/dist/supabase.js db push --remote=gpixjzkfovepghpdiikp --dry-run --skip-vault
```

Completa el flujo de `login` en el navegador y vuelve a la terminal. Abrir la página de acceso por sí solo no completa la autenticación. Si aparece `AccessTokenRequired`, termina el flujo seguro antes de intentar enlazar o migrar; la autorización del conector no se copia automáticamente a la CLI.

Contrasta las columnas local/remota de `migration list` con los archivos. En el proyecto inicialmente vacío deben estar pendientes las dos versiones. Si la primera ya figura aplicada, conserva su historial y aplica únicamente la segunda. Si ambas están aplicadas, no debe haber SQL pendiente. Una discrepancia o un esquema preexistente sin historial requiere revisión; no la ocultes marcando versiones como aplicadas ni editando migraciones ya ejecutadas.

El ensayo `--dry-run` enumera lo que se aplicaría. `--skip-vault` mantiene fuera de esta operación cualquier actualización de secretos de Vault. Tras revisar el destino y las migraciones pendientes, ejecuta:

```powershell
node node_modules/supabase/dist/supabase.js db push --remote=gpixjzkfovepghpdiikp --skip-vault
node node_modules/supabase/dist/supabase.js migration list --remote=gpixjzkfovepghpdiikp
node node_modules/supabase/dist/supabase.js db push --remote=gpixjzkfovepghpdiikp --dry-run --skip-vault
```

La lista final debe alinear las dos versiones y el segundo ensayo no debe proponer repetirlas. Conserva versiones, fecha y códigos de salida como evidencia. Revisa después los asesores de seguridad del proyecto y verifica tablas, RLS y permisos efectivos de la API. [Referencia de migraciones y despliegue de la CLI](https://supabase.com/docs/reference/cli/supabase-db-push).

En este proyecto las dos versiones ya quedaron aplicadas y el ensayo posterior quedó vacío. Al repetir la guía empieza por inventario/listado; el despliegue no debe intentar recrear el esquema inicial.

No uses `db reset`, `migration repair`, `--include-all`, `--include-seed` ni la semilla local como atajos en este proyecto. `pnpm demo:seed`, `pnpm verify:local` y la suite `test:e2e:journey` están diseñados para Supabase en loopback y rechazan URLs remotas. Conserva esa protección. No copies toda la configuración local al proyecto alojado: contiene puertos, servicios y opciones propios del entorno Docker.

## Configuración de Next.js y Auth

Prepara una configuración local privada para este destino y conserva por separado cualquier entorno anterior. Comprueba que `NEXT_PUBLIC_SUPABASE_URL` y ambas claves pertenecen a **gpixjzkfovepghpdiikp**, no a otro proyecto.

| Variable | Valor o procedencia para esta integración |
| --- | --- |
| `APP_URL` | `http://127.0.0.1:3002` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL API que muestra el proyecto seleccionado |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publicable `sb_publishable_…` del proyecto, o clave `anon` heredada compatible; el nombre de la variable se conserva |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave administrativa compatible del mismo proyecto, exclusivamente en servidor, para invitaciones |
| `DATABASE_URL` | Conexión administrativa obtenida del proyecto; suministrarla solo al proceso de aprovisionamiento o verificación que la necesite |
| `E2E_BASE_URL` | `http://127.0.0.1:3002` para las comprobaciones públicas contra este servidor |

No uses `DEMO_PASSWORD` ni el buzón Mailpit local como credenciales o correo del proyecto alojado. El servidor ordinario utiliza cookies de cada usuario y la API de Supabase; no necesita una conexión PostgreSQL administrativa permanente. Los clientes administrativos del repositorio están marcados `server-only`. Una clave publicable identifica la aplicación; las autorizaciones continúan dependiendo del usuario, las reglas de dominio y RLS. [Claves de API de Supabase](https://supabase.com/docs/guides/api/api-keys).

La academia admite **solo acceso por invitación**. En la configuración de Auth del proyecto alojado, desactiva el registro público de usuarios y mantén deshabilitadas las sesiones anónimas. Es el equivalente alojado de `enable_signup = false` y `enable_anonymous_sign_ins = false` del entorno local; el archivo `config.toml` local no aplica esas opciones automáticamente al proyecto remoto. No basta con que la interfaz carezca de formulario de registro. Verifica que un intento de registro público con una dirección de prueba controlada sea rechazado sin crear una identidad, y que la invitación administrativa seguida de confirmación siga funcionando.

En Auth → URL Configuration del proyecto, configura para esta prueba:

- Site URL: `http://127.0.0.1:3002`.
- Redirect URLs exactas: `http://127.0.0.1:3002/auth/confirm` y `http://127.0.0.1:3002/definir-clave`.

Mantén un único origen: no alternes `localhost`, `127.0.0.1`, 3000, 3001 y 3002. Antes del piloto cambia el origen a su dominio HTTPS, actualiza la aplicación y Auth, revisa las redirecciones permitidas y recompila. [Configuración de retornos de Auth](https://supabase.com/docs/guides/auth/redirect-urls).

El perfil mínimo para el destino alojado está en `supabase/hosted/supabase/config.toml`. Declara el origen 3002, las dos redirecciones, el registro público y las sesiones anónimas deshabilitados, contraseña mínima de doce caracteres y confirmación de correo. Desde la raíz del repositorio, revisa y aplica este perfil con:

```powershell
node node_modules/supabase/dist/supabase.js config diff --workdir supabase/hosted --remote=gpixjzkfovepghpdiikp
node node_modules/supabase/dist/supabase.js config push --workdir supabase/hosted --remote=gpixjzkfovepghpdiikp
node node_modules/supabase/dist/supabase.js config diff --workdir supabase/hosted --remote=gpixjzkfovepghpdiikp
```

Este perfil evita trasladar la configuración completa de Docker al proyecto remoto. Revisa las diferencias concretas y confirma el destino antes del `push`; después vuelve a comparar. En la ejecución registrada, el `push` aplicó correctamente las cuatro diferencias de Auth indicadas al inicio. Mantén las credenciales de SMTP fuera del archivo versionado.

La personalización de plantillas fue rechazada en este proyecto **Free con el proveedor de correo predeterminado**, con HTTP 400 y código `entitlement_required`. El servicio indicó que requiere SMTP propio o un plan habilitado. No se cambió el plan. Las secciones de plantillas se retiraron de la configuración activa, por lo que no se presentan como desplegadas.

Para completar el correo, configura un proveedor SMTP autorizado y destinatarios de prueba controlados. Después incorpora una sola vez al perfil activo las secciones de `supabase/hosted/email-templates.toml.example` y repite `config diff`, `config push` y la comparación posterior con el mismo `--workdir` y remoto. Las copias de las plantillas viven dentro de `supabase/hosted/supabase/templates/`: la CLI rechazó rutas que salían del directorio de trabajo. Conserva esas copias sincronizadas con `supabase/templates/invite.html` y `supabase/templates/recovery.html`.

Los enlaces de las plantillas usan `{{ .SiteURL }}/auth/confirm`, `token_hash={{ .TokenHash }}` y el tipo correspondiente `invite` o `recovery`. Esa ruta verifica el token y abre `/definir-clave`; no la sustituyas por una ruta de `/api/v1`. Verifica recepción, apertura del enlace y definición/recuperación de contraseña con una dirección que realmente reciba correo. Configurar SMTP o una plantilla no acredita esos pasos; no guardes enlaces de un solo uso como evidencia pública.

## Primer administrador

Aplica primero las migraciones. Desde Auth del proyecto crea o invita una identidad de prueba controlada, confirma su correo mediante el flujo previsto y verifica su UUID. El trigger crea el perfil de academia con rol inicial `student`; no asignes roles a través de metadatos editables por el usuario.

En esta integración se aprovisionó el primer administrador mediante **SQL restringido ejecutado por la CLI autenticada**, sin suministrar `DATABASE_URL`. La operación fijó el UUID de la identidad seleccionada, utilizó bloqueo y transacción, comprobó correo confirmado y perfil activo, y rechazaba continuar si ya existía un administrador. No fue una promoción mediante `UPDATE` genérico. No repitas el bootstrap en el proyecto ya aprovisionado.

Como alternativa para un entorno nuevo con conexión PostgreSQL administrativa disponible, el repositorio incluye el script restringido siguiente. Suministra la conexión de forma segura solo a ese proceso y sustituye el marcador por el UUID confirmado:

```powershell
pnpm admin:bootstrap '<UUID-confirmado-de-Auth>'
```

El comando ejecuta `scripts/bootstrap-admin.ts`. Exige UUID explícito, conexión con privilegio administrativo, identidad existente con correo confirmado y perfil activo. Bloquea la operación si ya existe cualquier administrador y conserva la promoción en una transacción con exclusión concurrente. No puede reutilizarse para añadir administradores posteriores y no existe una ruta HTTP pública equivalente. No expongas la conexión administrativa al proceso web después de usarla.

Comprueba el inicio de sesión y que `GET /api/v1/me` devuelve ese UUID y rol `admin`, seguido de `/administracion`. Las cuentas docentes y estudiantiles siguientes se invitan desde la administración de la academia; usa direcciones controladas que reciban correo. No ejecutes la semilla de cuentas locales en el proyecto alojado.

Para las pruebas actuales se crearon **cuatro cuentas ficticias distintas bajo `example.invalid`**: administración, docente, estudiante y estudiante sin matrícula. Auth Admin las creó con `email_confirm=true`; no se enviaron ni recibieron correos. Esto permite probar autenticación con contraseña y permisos, pero no acredita invitación, posesión de buzón ni recuperación. Las credenciales quedan en `.env.hosted-test.local`, ignorado por Git, y no se incluyen en esta guía.

## Producción local y aceptación con el proyecto alojado

Después de completar la configuración privada y Auth, ejecuta desde la raíz:

```powershell
pnpm openapi:validate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm start --port 3002
```

Abre `http://127.0.0.1:3002/campus`. `APP_URL` debe estar configurado en el proceso con ese mismo origen. Recompila al cambiar variables públicas. Mantén disponible otra terminal para verificaciones; no detengas servicios ajenos para liberar puertos.

Comprueba en escritorio y móvil, con cuentas de prueba distintas y contra esta API, este recorrido:

1. Administración invita docente y estudiante; ambos aceptan el correo. Verifica salida, recuperación y nueva entrada, con cookies SSR efectivas.
2. Docente crea un curso A1, una unidad, dos lecciones completas y una actividad obligatoria por lección. Guarda, previsualiza y publica. Administración matricula al estudiante; otra cuenta estudiantil permanece sin matrícula.
3. Estudiante entrega la primera lección. Comprueba feedback, nota separada y avance 1 de 2 (50 %) en la respuesta y en PostgreSQL. Cierra sesión y abre otro contexto de navegador: Continuar debe abrir la segunda lección.
4. Reenvía el mismo cuerpo con la misma clave: mismo intento y respuesta original, sin duplicado en base. Volver a practicar debe crear otro intento y conservar una sola lección completada.
5. Comprueba con sesiones y JWT reales que el alumno recibe solo la publicación, no claves de corrección ni borradores; que otro alumno no consulta sus intentos y que el alumno sin matrícula obtiene 404. Contrasta también PostgREST directo, incluidos los metadatos privados de `courses`.
6. Guarda una edición sin publicar y confirma que el alumno conserva el contenido publicado. Publica la revisión y verifica versiones vigentes, intentos históricos, reenvío de una solicitud antigua y rechazo de un intento nuevo contra una versión desplazada.

Los scripts de integración local no ejecutan este recorrido remoto. La suite específica `pnpm test:e2e:hosted`, definida en `playwright.hosted.config.ts`, exige el proyecto `gpixjzkfovepghpdiikp`, el origen 3002 y cuatro cuentas ficticias distintas de `example.invalid`. Lee `.env.hosted-test.local` y necesita la aplicación ya iniciada; no arranca el servidor. Su configuración requiere las variables de aplicación y las variables privadas `EIA_HOSTED_TEST_PASSWORD`, `EIA_HOSTED_ADMIN_EMAIL`, `EIA_HOSTED_TEACHER_EMAIL`, `EIA_HOSTED_STUDENT_EMAIL` y `EIA_HOSTED_OUTSIDER_EMAIL`.

El archivo privado de la suite no se carga automáticamente en Next.js: configura el servidor y el build por su entorno privado correspondiente. No expongas las credenciales de las cuentas de prueba como variables públicas. Una vez preparado el servidor:

```powershell
pnpm test:e2e:hosted
```

La suite crea un curso de prueba y contrasta práctica e historial mediante la Data API del proyecto real. Su cliente administrativo se limita al proceso de verificación; las interacciones de navegador usan las cuentas de cada rol. Las cuentas confirmadas administrativamente permiten ejecutar ese circuito mientras se completa SMTP, pero la suite no sustituye las pruebas pendientes de envío, aceptación de invitación y recuperación. Registra resultados reales, versiones aplicadas y fallos en el informe; no declares aprobado un paso que solo se haya inspeccionado o simulado.

Docker local continúa siendo una comprobación independiente. Las pruebas PGlite de instalación y actualización incremental ejercitan SQL y preservación de datos con una fixture Auth; no acreditan Supabase Auth, correo, PostgREST ni el recorrido alojado.

La aceptación alojada del 19-11-2026 pasó: un curso publicado y matriculado, dos prácticas persistidas, avance 1/2 recuperado en otro contexto móvil y acceso externo rechazado. Para contrastar permisos directamente con JWT y repetir dos reenvíos concurrentes del intento existente, utiliza el UUID del curso de aceptación completado:

```powershell
pnpm verify:hosted 5bcb6ff4-a3d2-42d3-8d5f-a266d9c5a1ee
```

El comando lee `.env.hosted-test.local` y está restringido al mismo proyecto y a las identidades ficticias. Espera la fixture de una publicación, dos lecciones, una matrícula y dos intentos creada por la suite; si cambias ese curso, selecciona el UUID de otra aceptación completa. Consulta RLS, esquemas privados y errores de autorización; reenvía solicitudes ya persistidas y compara siete tablas antes/después. Guarda únicamente resultados saneados en `test-results/hosted-security.json`. No crea cuentas, cursos o claves nuevas de intento. La evidencia de la corrida original está en `docs/evidencia/hosted-security.json`.

## Cambio de correo y paso al piloto

La fase 1 no incluye pantalla de cambio de correo. El perfil guarda una copia de `auth.users.email` al crear la identidad; las migraciones actuales no sincronizan automáticamente cambios posteriores. Un cambio de correo realizado por operación debe verificar la identidad y la confirmación en Auth, reconciliar `public.profiles.email` para el mismo UUID respetando su unicidad y comprobar `/api/v1/me`, ingreso, recuperación y matrícula por correo. No modifiques el correo del perfil como sustituto de la confirmación de Auth. La sincronización automática y su prueba quedan como trabajo pendiente de operación, sin afirmar que esta función exista en la interfaz.

Antes de abrir el piloto: origen HTTPS definitivo, correo probado con destinatarios autorizados, registro público y sesiones anónimas deshabilitados, revisión de permisos y asesores, aceptación del recorrido alojado, validación docente del material y restauración de respaldo en otro entorno aislado. La fase 1 no utiliza Storage; audio y archivos privados pertenecen a fase 2. Mantén separados los dictámenes de SQL local, pila local completa e integración alojada.
