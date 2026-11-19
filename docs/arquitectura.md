# English in Action — arquitectura de la fase 1

`FASE_ACTIVA = 1`. Una aplicación Next.js App Router con TypeScript estricto sirve la academia y la API REST `/api/v1`. Supabase aporta Auth y PostgreSQL. La interfaz usa español; los diálogos, objetivos y ejercicios de muestra usan inglés. Los públicos admitidos son escolar (`school`), universitario (`university`) y profesional (`professional`), con niveles MCER A1–C2.

La fase 1 abarca invitación, acceso, borrador, publicación, matrícula, lectura y corrección persistente. El contrato HTTP se escribió antes de implementar pantallas y se conserva en `docs/openapi.yaml`, OpenAPI 3.1. `src/lib/contracts.ts` contiene esquemas Zod y tipos reutilizables; distingue explícitamente material docente de material entregable al estudiante. El archivo de bloqueo fija las versiones instaladas.

## Capas y módulos

```text
Navegador ──JSON + cookies + Origin──> Route Handler
Componentes de servidor ────────────> servicios de dominio
Route Handler ──esquemas Zod────────> servicios de dominio
servicios ──────────────────────────> repositorio de sesión
repositorio ──JWT del usuario───────> RPC PostgreSQL + RLS + restricciones
Auth SSR <────────────── cookies ───> Supabase Auth
```

`src/app/api/v1/**/route.ts` solo adapta HTTP: valida el origen, la sesión, los parámetros y el cuerpo; llama al servicio; transforma el resultado en estado HTTP y sobre `{data}`. Los fallos usan `{error:{code,message,fieldErrors?}}`. `src/lib/http.ts` unifica estas reglas, rechaza cuerpos no JSON y limita las cargas HTTP a 512 KiB: comprueba el tamaño declarado y cuenta los bytes durante la lectura, cancelando el flujo al superar el límite. Las rutas de campo de los errores Zod usan puntos, por ejemplo `document.units.0.lessons.0.objective`.

`src/lib/services.ts` ofrece las operaciones de dominio que usan tanto los handlers como las lecturas de componentes de servidor. `src/lib/repository.ts` crea un cliente con las cookies de esa petición, verifica `auth.getUser()` y ejecuta RPC con ese usuario. Las reglas que necesitan consistencia transaccional se ejecutan en PostgreSQL; una lectura de servidor no omite autorización por ser interna. No se usan clientes globales que compartan la sesión de distintas personas.

Los módulos lógicos son:

| Módulo | Responsabilidad | Persistencia |
| --- | --- | --- |
| Identidad | Sesión, perfil administrado, invitación y recuperación | `auth.users`, `profiles`, `invitations` |
| Autoría | Curso propio, árbol de borrador, revisión y publicación inmutable | `courses`, `drafts`, `releases`, `release_lessons`, `lesson_versions`, `private.answer_keys` |
| Matrículas | Vincular una cuenta estudiantil activa a un curso publicado | `enrollments` |
| Práctica | Índice vigente, contenido seguro, corrección, reenvío y avance | `attempts`, versión publicada y claves privadas |

Las RPC `api_me`, `api_courses`, `api_create_course`, `api_get_draft`, `api_save_draft`, `api_publish`, `api_enroll`, `api_outline`, `api_lesson` y `api_attempt` forman la frontera transaccional. La reserva y finalización de invitaciones usan dos operaciones adicionales, porque el envío de correo a Auth no puede participar de una transacción PostgreSQL.

## Identidad, sesiones y correos

El rol procede de `profiles.role` y su estado de `profiles.active`, administrados por servidor. El trigger de creación de un usuario asigna inicialmente `student`; los metadatos editables del usuario pueden aportar un nombre, nunca un rol. Las invitaciones autorizadas asignan `teacher` o `student` desde el servidor. El administrador inicial se crea mediante el aprovisionamiento local documentado en el README; no existe un formulario público para elevar privilegios.

El cliente SSR de `src/lib/supabase/server.ts` administra cookies con `HttpOnly`, `SameSite=Lax`, ruta `/` y `Secure` en producción. `src/proxy.ts` renueva la sesión y propaga las cookies renovadas hacia la petición y la respuesta. La autorización vuelve a verificar el usuario con Auth y consulta el perfil de base de datos; no confía únicamente en una cookie decodificada.

Todas las escrituras HTTP exigen `Origin` igual al origen de `APP_URL`, incluidas las rutas de acceso y recuperación. Se rechazan peticiones marcadas como `cross-site`. Las respuestas personales usan `Cache-Control: private, no-store`; no se utiliza un caché compartido para perfiles, cursos de un alumno ni respuestas de práctica.

La ruta `GET /auth/confirm` está fuera de `/api/v1` porque es el destino de navegación de los correos, no una operación JSON. Solo admite `token_hash` y tipos `invite` o `recovery`, verifica el token con Auth, escribe la sesión y redirige a `/definir-clave`. Un enlace inválido vuelve a `/ingresar?error=invalid_link`. Los destinos son fijos para impedir redirecciones abiertas y el retorno no envía el token como `Referer`.

Las plantillas locales de invitación y recuperación deben apuntar al mismo `APP_URL` con `token_hash` y el tipo correspondiente. Supabase local entrega los correos al buzón de prueba. La recuperación devuelve el mismo mensaje genérico para una solicitud aceptada y una cuenta inexistente; los fallos operativos del proveedor devuelven `502 recovery_unavailable` con un mensaje genérico que permite reintentar sin revelar identidades. La clave de `service_role` se importa solo desde código de servidor y se usa para las operaciones administrativas puntuales de Auth y el aprovisionamiento de ejemplos; las operaciones ordinarias usan el JWT de sesión.

La invitación reserva un correo normalizado mediante un índice único de invitaciones en curso antes de enviar. El resultado se marca como enviado o fallido. Esto evita correos duplicados por concurrencia; un fallo después de que Auth aceptó el correo y antes de registrar su éxito requiere reconciliar el estado de Auth y la reserva. No se promete una transacción distribuida entre el correo y PostgreSQL.

## Lectura y escritura por rol

La API aplica rol y pertenencia; RLS protege también las consultas directas a tablas. `anon` no tiene acceso a tablas de la academia. `authenticated` tiene únicamente los permisos `SELECT` previstos y `EXECUTE` en RPC autorizadas. Las escrituras de dominio se realizan dentro de funciones con comprobaciones explícitas, no mediante permisos generales `INSERT`, `UPDATE` o `DELETE`.

| Dato | Administración | Docente | Estudiante |
| --- | --- | --- | --- |
| Perfil | Lee perfiles; el aprovisionamiento administra rol/estado | Lee su perfil | Lee su perfil |
| Invitaciones | Crea y consulta invitaciones `student`/`teacher` | Sin acceso | Sin acceso |
| Catálogo | Lee el catálogo interno | Lee y crea sus cursos | Lee sus cursos matriculados |
| Borrador y soluciones | Sin acceso editorial ordinario | Lee y guarda solo los cursos propios | Sin acceso |
| Publicaciones | Lee los metadatos del catálogo | Publica su curso y consulta sus versiones | Lee la publicación vigente de cursos matriculados |
| Lecciones públicas | Sin endpoint de práctica | Consulta los materiales propios mediante autoría | Lee las versiones vigentes de cursos matriculados, sin soluciones |
| Claves de corrección privadas | Sin consulta mediante la API ordinaria | Las edita dentro del borrador propio | Nunca las consulta directamente |
| Matrículas | Crea matrículas y consulta registros | Puede leer registros de sus cursos mediante RLS | Lee solo las propias |
| Intentos y corrección | Sin acceso ordinario a intentos ajenos | Sin informe de resultados en fase 1 | Crea y consulta solo sus propios registros |

Las claves publicadas y su huella se conservan en `private.answer_keys`, con RLS y sin permisos de lectura de tabla para `anon` o `authenticated`. Las versiones públicas se construyen mediante una lista explícita de campos permitidos; omiten `correctOptionId` y ambos comentarios `feedback`. La corrección elige y devuelve solo el comentario correspondiente a cada respuesta después de un intento válido. La edición completa de soluciones permanece en `drafts`, cuya política permite leer exclusivamente al autor.

`courses` conserva metadatos mutables del borrador y su lectura directa queda limitada a administración y al autor. El estudiante obtiene título, nivel, público y revisión de la publicación vigente mediante `api_courses`. Los predicados de la segunda migración permiten leer las publicaciones y lecciones vigentes sin otorgar acceso a los metadatos del borrador.

Las funciones `SECURITY DEFINER` tienen `search_path` fijo y permisos de ejecución explícitos. Esto permite realizar operaciones indivisibles sin conceder escrituras generales a los clientes. Cada función comprueba `auth.uid()`, estado del perfil, rol, propiedad y matrícula según corresponda antes de leer o modificar el recurso. Los predicados privados de RLS devuelven únicamente booleanos para evitar recursión de políticas.

Un rol incorrecto recibe `403`; un recurso inexistente o ajeno y una lección sin matrícula reciben `404`. El estudiante sin matrícula no puede distinguir si existe el curso mediante los endpoints de lectura de práctica. `401` indica que debe iniciar sesión; `409` indica una revisión o versión desplazada, una invitación en curso o una clave de reintento en conflicto; `422` identifica datos inválidos.

## Borrador, publicación y versiones

El árbol de autoría conserva el orden de unidades, lecciones, bloques, actividades y opciones. Los cursos y versiones usan UUID; los elementos del documento usan identificadores estables de hasta 80 caracteres, formados por letras, números, guiones y guiones bajos. Los identificadores de unidad son únicos en el curso; los de lección también son únicos en todo el curso. Bloques y actividades son únicos dentro de su respectiva colección de la lección, y las opciones dentro de cada actividad.

Los borradores admiten textos incompletos y arreglos vacíos, pero requieren formas válidas y tipos conocidos. `PUT /draft` compara `expectedRevision` con la revisión guardada bajo bloqueo e incrementa la revisión. Un conflicto no sobrescribe el trabajo de otra pestaña. La publicación vigente permanece independiente de los cambios del borrador.

La publicación valida título, nivel y público, al menos una unidad y una lección completa por unidad. Cada lección exige título, objetivo observable, contenido y una actividad obligatoria como mínimo. Todas las actividades presentes deben tener enunciado, al menos dos opciones, una solución que exista y feedback para acierto y error. El docente debe revisar los objetivos y los materiales antes de utilizarlos con estudiantes reales.

`api_publish` bloquea el curso y el borrador, valida, crea una publicación inmutable, crea o reutiliza versiones de lección, registra su orden y cambia el puntero `current_release_id` dentro de una sola transacción. La restricción única `(course_id, revision)` recupera el mismo `releaseId` al repetir una publicación, incluso si después se editó el borrador. Ese reenvío no retrocede la publicación vigente.

La identidad de versión depende del curso, el identificador estable de lección y la huella del contenido completo y su evaluación. El orden de la lección dentro del curso no participa de esa huella. Reordenar lecciones conserva sus versiones; modificar texto, objetivo o evaluación crea una versión distinta. Los registros de publicación, versión, claves e intento rechazan modificaciones y borrados mediante triggers. Una nueva publicación no destruye intentos históricos.

## Matrícula, corrección e idempotencia

La matrícula exige administración, un curso publicado, un perfil estudiantil activo y correo confirmado en Supabase Auth. Una invitación pendiente de aceptación no basta para matricular. La restricción única `(course_id, student_id)` resuelve la concurrencia: la primera operación crea el registro y devuelve `201`; las siguientes recuperan su identificador y devuelven `200`.

El envío de práctica usa `Idempotency-Key`, `lessonVersionId` y una respuesta por actividad obligatoria. El servidor rechaza actividades repetidas, desconocidas, opciones ajenas y respuestas obligatorias ausentes. Las actividades opcionales pueden omitirse; el denominador de la nota cuenta las actividades respondidas válidamente. Un envío válido completa la lección aunque incluya errores. Nota y avance se presentan por separado.

`api_attempt` serializa la operación con el curso, comparte ese bloqueo con publicación y usa una restricción única por estudiante, curso, lección y clave. Primero busca una operación ya procesada: si el cuerpo JSON coincide, devuelve el intento y su respuesta originales con `200`, antes de comprobar cambios posteriores de la lección. Si la clave ya existe con otro cuerpo devuelve `409 idempotency_conflict`. Si es un nuevo intento con una versión que ya no está vigente, devuelve `409 lesson_changed`. La igualdad de JSON no depende del orden de las propiedades; sí del contenido y del orden de sus arreglos.

Una práctica voluntaria nueva lleva una nueva clave y conserva otro intento. La interfaz conserva la clave mientras reintenta la misma petición. La transacción calcula nota, comentarios y avance, y guarda la respuesta original antes de confirmar. No hay un momento intermedio en que exista un intento sin su resultado. El bloqueo por curso simplifica la demostración y evita carreras con publicación; en un piloto con concurrencia alta debe medirse su contención antes de cambiar la estrategia.

El avance usa únicamente versiones de lección de la publicación vigente. Una versión cuenta una vez si tiene un intento válido de ese estudiante. `nextLessonId` es la primera pendiente según el orden docente o `null`. Al reutilizar una versión permanece el avance asociado; una lección modificada exige completar su nueva versión. Los intentos de versiones anteriores siguen conservados. El progreso devuelto por un reenvío es la fotografía del intento original; una nueva lectura del índice devuelve el progreso vigente.

## Ejemplos, verificación y operación

### Interfaz de la fase 1

Las lecturas de `/campus`, `/docente`, `/administracion`, el índice, la lección y el editor se resuelven en Server Components mediante los mismos servicios autorizados. El rol de `getMe` determina el destino; `/panel` queda como redirección compatible. Los formularios de cliente usan el contrato HTTP. El campus prioriza un curso en progreso y consulta su índice para mostrar la siguiente lección y el avance vigente. No calcula completados desde el almacenamiento del navegador.

El editor mantiene borrador y revisión, previsualiza solo los campos visibles para el estudiante y solicita confirmación antes de guardar/publicar. La vista previa no entrega intentos ni inventa métricas. Un conflicto conserva la edición local. El estado editorial muestra la revisión del borrador por separado de la disponibilidad de la publicación; no atribuye una revisión publicada que el contrato no devuelve.

`components/api.ts` centraliza errores y notifica un 401 de operaciones protegidas. `SessionRecovery` permite reautenticar la misma identidad y rol sin desmontar el editor ni la práctica; el usuario reintenta después de restablecer la sesión. Los rechazos de credenciales no se confunden con una sesión caducada. Los 401 en lecturas de servidor redirigen al acceso con un aviso explícito. Las copias de recuperación e idempotencia permanecen separadas por cuenta y se limpian al cerrar sesión deliberadamente.

El ejemplo reproducible es **First Conversations**, A1 universitario, con una unidad y dos lecciones: **Introducing yourself** e **Introducing a classmate**. Incluye diálogos originales, objetivos observables, opción única obligatoria y feedback. Hay un administrador, un docente autor, un estudiante matriculado y otro sin matrícula. La semilla es idempotente y se ejecuta por separado del esquema.

La semilla identifica el curso con `private.seed_registry`, un registro privado con clave única y referencia al curso, sin permisos para `anon` ni `authenticated`. El script exige que tanto Supabase como `DATABASE_URL` apunten a loopback. Una transacción PostgreSQL obtiene un bloqueo asesor por semilla, busca su marcador y, si falta, crea el curso mediante `api_create_course` con el rol `authenticated` y la identidad del docente; después registra el marcador con la conexión administrativa local y confirma ambos cambios juntos. Una interrupción revierte curso y marcador, de modo que el siguiente intento no deja un curso duplicado sin identificar. La semilla conserva publicaciones e intentos existentes; no utiliza metadatos de Auth como marcador separado del curso.

Las migraciones SQL son la fuente del modelo de datos y de los permisos. Las verificaciones deben cubrir el contrato OpenAPI, tipos, lint, build, migración en PostgreSQL de prueba y casos de integración de publicación, matrícula, corrección, aislamiento, reenvío, conservación de historial y acceso directo a tablas. Las pruebas de Auth, correo, cookies y recorrido de navegador requieren además Supabase local en funcionamiento. El README registra los comandos, resultados efectivamente ejecutados y cualquier comprobación pendiente; este documento describe el diseño y no sustituye evidencia de ejecución.

El paso al piloto utiliza un servidor Node.js que ejecute el build de Next.js y un proyecto Supabase de pruebas independiente. Se aplican las migraciones revisadas sin reinicializar los datos existentes. `APP_URL`, URL/clave pública de Supabase, clave de servicio y credenciales de correo tienen valores separados del entorno local; la clave privilegiada no lleva prefijo `NEXT_PUBLIC_`. Se configuran HTTPS, URLs de retorno y plantillas de correo del piloto, y se prueba invitación y recuperación desde el dominio real.

Antes de abrir el piloto se debe restaurar un respaldo de la base —incluidas las identidades necesarias según el mecanismo de respaldo utilizado— en un entorno aislado, verificar los vínculos de perfiles, publicaciones, matrículas e intentos y ejecutar de nuevo el recorrido por roles. Cuando se incorpore Storage, la restauración debe incluir también los objetos de los buckets privados y su correspondencia con los registros de medios; un respaldo SQL no contiene por sí solo esos archivos. Los datos ficticios y las credenciales locales no se reutilizan con personas reales.

## Evolución compatible

La fase activa permanece en `1`; las fases siguientes requieren verificar la anterior y ampliar contrato, tipos, migraciones y pruebas preservando sus operaciones y datos.

En fase 2 se añade el módulo de medios con Storage privado, reservas de carga, comprobación de tamaño/tipo y URLs temporales autorizadas. `blocks` incorpora audio y transcripción; `activities` incorpora huecos con normalización de espacios, variantes y regla de mayúsculas. Una publicación exige audio listo y transcrito. Historial e informe docente se derivan de intentos inmutables; el informe toma el último intento por alumno, lección y versión vigente. Los medios se autorizan por uso y pertenencia, nunca solo por conocer un identificador.

En fase 3 se añaden grupos, pertenencias, sesiones, tareas, entregas y revisiones. La membresía limita agenda y evidencias al grupo correspondiente. Las entregas son únicas por alumno/tarea y editables hasta el vencimiento o su revisión; el profesor califica la revisión que leyó y registra puntos por criterio. Las entregas orales reutilizan medios privados con verificación de propietario, tarea y uso. Esos resultados permanecen separados del avance de lecciones. Los instantes se guardan en UTC y se presentan en `America/Bogota` por defecto. Las ampliaciones se realizan mediante nuevas migraciones y discriminadores por tipo; no se reinicia la base ni se reescribe el historial.
