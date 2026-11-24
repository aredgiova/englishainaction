# Verificación del acceso integrado a la aventura

Fecha: 24 de noviembre de 2026.

## Alcance implementado

English Learning Adventure es un curso ilustrado protegido por sesión y permiso. Sus dos tarjetas se muestran en administración y, cuando están autorizados, en los paneles docente y estudiante. Administración permite o retira el acceso individual a ambas misiones desde «Quién puede entrar». No se necesita importar, publicar ni matricular la aventura en el motor de cursos genéricos.

La migración `20261124224818_adventure_access_progress.sql` se aplicó al Supabase conectado a la plataforma. Habilitó al docente y a los dos estudiantes activos existentes, todos ellos cuentas ficticias de verificación; administración mantiene acceso con cuenta activa. Esta activación es una instantánea: las cuentas posteriores necesitan habilitación manual. No se cambiaron los perfiles para otorgar permiso.

Las tablas privadas de acceso y progreso tienen RLS activada, con acceso directo revocado a los roles de cliente. Las seis RPC públicas delegan en funciones privadas que verifican identidad, actividad y rol del perfil persistido. El progreso solo contiene paradas completadas de la cuenta autenticada; retirarle acceso bloquea lecturas y escrituras y conserva sus datos.

Acceso, recuperación y definición de contraseña usan el mundo ilustrado de Welcome Harbor, Nunito local y formularios breves. Las dos ilustraciones originales existentes se reutilizan en las tarjetas. El resto del marco operativo de la academia se preserva.

## Resultados confirmados

| Comprobación | Resultado |
| --- | --- |
| `pnpm test` | 118 pruebas aprobadas |
| Integración de base de datos | 35 pruebas aprobadas, incluidas en las 118 |
| `pnpm openapi:validate` | Aprobado; 18 rutas documentadas |
| `pnpm typecheck` | Aprobado |
| `pnpm lint` | Aprobado |
| `pnpm build` | Compilación de producción aprobada |
| `pnpm test:e2e:auth-design` | 3 pruebas aprobadas |
| `pnpm test:e2e:adventure:hosted` | 1 prueba multirrol aprobada, aproximadamente 58 s |
| `pnpm test:e2e:adventure` | 3 pruebas aprobadas, aproximadamente 49 s |
| Revisión visual independiente | PASS en acceso, recuperación, catálogo de los tres roles y gestor de acceso; sin hallazgos materiales |
| Revisión de código independiente | PASS, sin hallazgos |
| Despliegue web de esta entrega | READY en Vercel; dominio de producción actualizado |
| Comprobación en producción | Login en escritorio/móvil, protección anónima y apertura de ambos módulos con los tres roles aprobados |

Son siete pruebas de navegador en total. TypeScript, ESLint, OpenAPI y compilación se volvieron a ejecutar satisfactoriamente al cerrar la implementación.

## Publicación confirmada

El código de aplicación `3cddc7cc1aa4abdc61f1ce2eca00301629d7faba` se subió a `main` en `aredgiova/englishainaction`, con autor y autenticación de Git verificados como `aredgiova`. Vercel publicó ese commit en el despliegue `dpl_GxQmRM7vwFN2KXmpERyMN5e2N9DK`, con estado `READY`, destino `production` y alias [englishainaction.vercel.app](https://englishainaction.vercel.app/ingresar). La documentación de cierre se registra en un commit posterior sin cambios de aplicación.

La comprobación adicional sobre el dominio público confirmó imagen cargada y ausencia de desbordamiento a 1440 y 390 px, redirección de anónimos al login, inicio de sesión real de administración/docente/estudiante, dos tarjetas en cada panel y apertura de ambas misiones. Las consultas de permisos y progreso respondieron correctamente; docentes y estudiantes no pudieron consultar el gestor administrativo. No hubo errores de ejecución del navegador. Esta comprobación no modificó permisos, cursos ni progreso.

| Superficie revisada | Veredicto visual |
| --- | --- |
| Acceso y recuperación | PASS |
| Catálogo de administración | PASS |
| Gestor «Quién puede entrar» | PASS |
| Catálogo docente | PASS |
| Catálogo estudiante | PASS |

## Qué comprueban las pruebas

La integración PostgreSQL comprueba la activación inicial sin alterar perfiles, ausencia de permiso automático para cuentas futuras, administración exclusiva de permisos, rechazo de cuentas inactivas, aislamiento por cuenta, las 23 paradas canónicas, reinicio por misión, idempotencia, revocación con conservación del avance, validación de entradas y denegación del acceso directo o anónimo.

La prueba multirrol usa inicio de sesión real con cuentas ficticias existentes y Supabase remoto. Comprueba las tarjetas y aperturas desde los tres paneles, ausencia de contenido para anónimos, rechazo por ruta y API sin permiso, administración exclusiva de accesos, persistencia de la primera parada y recuperación en otra sesión móvil. Retira y restablece el permiso y verifica que el avance continúe. Al terminar restaura los permisos y conjuntos de progreso originales de las cuentas utilizadas.

Las tres pruebas de misiones verifican los recorridos completos de ambas misiones, respuestas y reintentos, guardado y recuperación del avance, reinicio, presentación en escritorio y móvil y reproducción, detención y error de la voz con la API de voz simulada. La prueba acústica no evalúa la calidad de las voces instaladas.

Las tres pruebas de acceso comprueban la composición a 1440 y 390 px, navegación por teclado y salto al formulario, ausencia de desbordamiento, mostrar y ocultar contraseña, conservación de campos tras error, recuperación, validación de confirmación y avisos de sesión o enlace caducado. Sus respuestas de autenticación están simuladas; el inicio de sesión real se cubre en la prueba multirrol.

## Evidencia y límites

Las capturas en `docs/evidencia/auth/` cubren acceso y recuperación a 1440 y 390 px; las dos de login se actualizaron desde producción. Las de `docs/evidencia/access/` cubren los paneles de administración, docente y estudiante a esos anchos, con las secciones de cursos ajenos a la prueba enmascaradas. La revisión visual independiente aprobó las superficies indicadas.

Las suites automatizadas se ejecutaron con la aplicación servida localmente y Supabase remoto para las pruebas autenticadas; después se verificó el dominio público con los tres roles. No se usaron cuentas institucionales reales. La suite general de invitaciones y recuperación mediante buzón local no forma parte de esta verificación.

My World requiere validación curricular. La práctica oral y escrita usa modelos y autoevaluación; no ofrece calificación automática. La aplicación no graba el micrófono ni envía los textos de práctica, y el progreso no certifica dominio del idioma.

El [informe anterior](verificacion-aventura-2026-11-24.md) se conserva sin cambios como registro de la etapa de laboratorio público y plantilla docente. El comportamiento vigente se describe en [aventura.md](aventura.md).
