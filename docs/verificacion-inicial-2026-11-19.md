# Evidencia de verificación · fase 1

Fecha: **19 de noviembre de 2026**, zona de referencia `America/Bogota`. Repositorio nuevo, Windows, Node.js 22.15.0 y pnpm 11.25.0. Versiones exactas y dependencias transitivas en `pnpm-lock.yaml`.

## Comprobaciones realizadas

| Comprobación | Resultado real |
| --- | --- |
| `pnpm openapi:validate` | Aprobada: OpenAPI 3.1.0, 14 rutas y 16 operaciones |
| `pnpm typecheck` | Aprobada: TypeScript estricto, sin errores |
| `pnpm lint` | Aprobada: sin errores ni advertencias de código |
| `pnpm test` | Aprobadas 70 pruebas: 44 de contratos, 13 de PostgreSQL, 7 HTTP, 2 de recuperación y 4 del cliente HTTP |
| Migración SQL en base de prueba | Ejecutada íntegramente en PostgreSQL embebido PGlite, con roles y RLS reales |
| `pnpm build` | Aprobada: compilación optimizada de producción con webpack, tipos y generación de rutas |
| `pnpm dev` | Servicio HTTP iniciado en `http://127.0.0.1:3000` |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e` | Aprobadas 2 pruebas de acceso/recuperación en navegador real; tamaños 1440×1000 y 390×844, sin desbordamiento horizontal |
| `PLAYWRIGHT_CHANNEL=chrome pnpm test:e2e:journey` | Intentada, salida 1 en preflight por ausencia de `.env.local`; ningún recorrido autenticado ejecutado ni declarado aprobado |
| Revisión visual | Capturas reales de acceso en escritorio y móvil revisadas; se ve el aviso de Supabase sin configurar |
| Revisión de seguridad | Corregidos límite de cuerpo por bytes durante lectura, errores operativos de recuperación y marcador atómico de semilla |

Las pruebas de PostgreSQL usan la migración de producción y comprueban:

- Roles administrados por servidor; metadatos de usuario no elevan privilegios.
- Publicación validada y atómica, borradores incompletos, conflictos de revisión y aislamiento entre autores.
- Soluciones y huellas privadas inaccesibles mediante tablas; contenido publicado sin claves ni feedback previo.
- Corrección persistente: 1/2 de avance incluso con error, reenvío con un solo intento y nueva práctica con otro identificador.
- Sesión de base nueva que recupera el mismo avance; una segunda cuenta no ve intentos ajenos ni lecciones sin matrícula.
- Reordenamiento que conserva versiones, nueva publicación que conserva historial y rechazo `lesson_changed` de un envío nuevo sobre versión desplazada.
- Matrícula única que exige correo confirmado, invitaciones reservadas, publicación inmutable y privilegios mínimos de escritura.
- Marcador de semilla y curso confirmados o revertidos juntos; reserva inaccesible para el estudiante.

La capa HTTP comprueba sesión, rechazo de orígenes ajenos, cuerpos inválidos o excesivos, códigos 201/200/404/409/422, errores de campos y ausencia de caché compartida. Las pruebas de recuperación comprueban respuestas genéricas para cuentas existentes o ausentes y error operativo para fallos del proveedor. Las cuatro pruebas nuevas del cliente comprueban aviso de sesión caducada en 401 protegido, distinción de credenciales incorrectas, conservación de datos de conflicto y transmisión idéntica de cuerpo/clave al reintentar. Estas cuatro pruebas usan `fetch` simulado y no sustituyen la autenticación real.

La ampliación de interfaz incorpora `/campus`, `/docente` y `/administracion`, redirecciones por perfil verificado, siguiente lección del servidor, estados editoriales separados, vista previa, confirmación de publicación, recuperación de sesión sin desmontar formularios y consulta/resolución del borrador vigente. La suite `tests/e2e/journey.spec.ts` está preparada para los tres roles, dos tamaños, invitación/recuperación en Mailpit, 401 real al retirar cookies, 409 de revisión, reenvío y nueva práctica, persistencia tras entrar otra vez, 404 sin matrícula y aislamiento de publicaciones. Sus resultados siguen pendientes del entorno descrito a continuación.

Una revisión independiente detectó y comprobó la corrección de un conflicto editorial sin salida:

| Hallazgo | Disposición de cierre |
| --- | --- |
| P2: consultar la versión vigente dejaba la revisión local obsoleta y repetía el 409 | Resuelto en código: cargar la versión conserva primero copias completas descargables, adopta documento/revisión y permite guardar de nuevo; si falla el respaldo no reemplaza el trabajo. El E2E exige descarga y lectura del respaldo, guardado 200 y publicación intacta. Ejecución autenticada pendiente. |

El detector visual no encontró incidencias en los componentes revisados. Esta revisión de código y las capturas públicas no sustituyen una inspección móvil/escritorio de las pantallas autenticadas.

## Comprobaciones bloqueadas por el entorno

**No hay Docker Engine ni Podman disponibles, y WSL no está instalado.** `wsl.exe` existe como lanzador de Windows, pero `wsl --status` devuelve que el subsistema no está instalado. `pnpm db:start` volvió a fallar con el diagnóstico de Docker ausente. En la verificación inicial se intentó también `pnpm exec supabase start`: el CLI devolvió `DockerLifecycleInspectError`, indicando que no encuentra Docker ni Podman. No se instaló software de sistema ni se reinició Windows.

Por ello **no se generó `.env.local`, no arrancó la pila Supabase y no se cargó la semilla en Supabase**. `pnpm verify:local` se intentó y se detuvo por ausencia de `.env.local`. No se declaran aprobadas estas comprobaciones:

1. Migración en PostgreSQL del contenedor Supabase y semilla real con sus cuatro identidades.
2. Sesiones reales de Supabase Auth, cookies SSR y vuelta a entrar con avance 1/2.
3. Invitación y recuperación entregadas al buzón local y confirmadas desde el enlace.
4. RLS vía PostgREST y concurrencia entre dos conexiones PostgreSQL/HTTP independientes.
5. Recorrido autenticado completo en navegador: autor crea/publica dos lecciones, administración invita/matricula y estudiante entrega/retoma.

PGlite ejecuta PostgreSQL real, pero el esquema de Auth y el contexto JWT son fixtures. Las pruebas simultáneas embebidas quedan encoladas en una conexión; no acreditan carreras entre conexiones. Los adaptadores HTTP usan servicios simulados para comprobar su contrato. Las capturas y las dos pruebas de navegador cubren el acceso sin backend configurado, no un recorrido autenticado.

## Cómo completar la verificación

Con Docker Engine activo: `pnpm db:start`, `pnpm demo:seed`, `pnpm dev` y, en otra terminal, `pnpm verify:local` y `pnpm test:e2e:journey`. El primero ejercita Auth, cookies, PostgREST, dos conexiones reales, invitación y recuperación en Mailpit; el segundo ejecuta la interfaz en escritorio y móvil. En este Windows configura antes `$env:PLAYWRIGHT_CHANNEL='chrome'`. Ver `docs/local-verification.md` para el buzón y `docs/guia-docente.md` para la demostración manual. Registra los resultados antes de cerrar la aceptación.

El piloto y la restauración de sus respaldos quedan fuera de esta ejecución local y deben verificarse en infraestructura independiente. No cambies `FASE_ACTIVA` a 2 hasta cerrar los pendientes de la fase 1.
