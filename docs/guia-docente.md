# Demostración docente — fase 1

El ejemplo es **First Conversations**, A1 universitario: una unidad, **Introducing yourself** e **Introducing a classmate**. Los diálogos, objetivos, opciones y feedback originales están en `src/lib/demo-content.ts`. El docente debe validar el material antes de usarlo con estudiantes reales.

## Usar English Learning Adventure

Las dos misiones ilustradas se abren directamente desde las tarjetas de `/docente` cuando administración ha habilitado la cuenta. El estudiante autorizado encuentra las mismas tarjetas en `/campus`; no hace falta importar, publicar ni matricular la aventura como un curso nuevo. Administración gestiona el permiso individual de ambas misiones en «Quién puede entrar». El avance se guarda por cuenta y retirar el permiso lo conserva.

Las cuentas docentes y estudiantiles activas al aplicar la migración recibieron el permiso inicial elegido por el usuario. Las cuentas posteriores necesitan habilitación manual. My World requiere validación curricular, y las prácticas de habla y escritura usan modelos y autoevaluación sin calificación automática. Consulta [aventura.md](aventura.md) y la [verificación actual de acceso](verificacion-acceso-2026-11-24.md). El recorrido de First Conversations que sigue corresponde al motor independiente de cursos de autoría.

## Preparar el entorno local

Con Docker activo y las dependencias instaladas, ejecuta `pnpm db:start`, `pnpm demo:seed` y `pnpm dev`. `db:start` genera `.env.local`; las cuentas ficticias usan su valor `DEMO_PASSWORD`. Abre `http://127.0.0.1:3000` y el buzón `MAILBOX_URL` indicado en ese archivo.

| Cuenta | Uso |
| --- | --- |
| `docente@englishinaction.test` | Crear, editar y publicar en `/docente` |
| `admin@englishinaction.test` | Invitar y matricular en `/administracion` |
| `estudiante@englishinaction.test` | Practicar en `/campus` |
| `sinmatricula@englishinaction.test` | Comprobar que una lección ajena permanece inaccesible |

## Reproducir el recorrido

1. Entra como docente. Pulsa **Crear un curso**, usa un título nuevo y elige A1 / Universitario. Añade una unidad y las dos lecciones del ejemplo. Completa objetivo, texto, pregunta, tres opciones, respuesta correcta y ambos comentarios de feedback. Puedes reordenar con **Subir** y **Bajar**.
2. Pulsa **Guardar borrador**. En **Previsualizar como estudiante**, recorre ambas lecciones; la vista no entrega intentos ni muestra soluciones. Vuelve al editor, pulsa **Publicar curso**, revisa el resumen y elige **Confirmar publicación**. Guardar un borrador no cambia la versión publicada.
3. Sal y entra como administración. Invita un correo ficticio nuevo con rol Estudiante. Abre su mensaje en el buzón local, sigue la invitación y define una contraseña. Solo entonces matricula ese correo, o el estudiante de la semilla, en el curso nuevo.
4. Entra como estudiante. Pulsa **Comenzar** en el curso nuevo y entrega la primera actividad. Una respuesta incorrecta también completa la lección: **Aciertos** y **Avance del curso** se muestran por separado. Debe aparecer **1 de 2 lecciones / 50 %**.
5. Recarga esa lección y reenvía la práctica recuperada: conserva el intento. **Volver a practicar** inicia otro intento. Sal y vuelve a entrar; el avance se recupera del servidor y **Continuar** abre la segunda lección. Complétala: verás **2 de 2 / 100 %** y **Repasar**.
6. Cambia y guarda el objetivo de la primera lección como docente sin publicar. El estudiante conserva el objetivo publicado. En otra sesión, la cuenta sin matrícula no puede abrir esa lección.
7. Para recuperar acceso, usa **Olvidé mi contraseña**, abre el correo de recuperación en el buzón y define una contraseña nueva. Si la sesión caduca durante la edición, **Restablecer sesión** permite entrar con la misma cuenta sin perder el formulario; vuelve a guardar.
8. Si dos pestañas editan la misma revisión, **Ver versión vigente** muestra el borrador guardado para comparar y **Volver al editor** conserva lo escrito. Para resolver el conflicto, elige **Cargar versión vigente**: conserva una copia local de los cambios anteriores y adopta la revisión actual. Pulsa **Descargar mis cambios anteriores** para guardar ese JSON antes de cerrar sesión; integra los cambios que quieras conservar y vuelve a **Guardar borrador**. Si el navegador no permite guardar el respaldo local, la aplicación conserva la edición original y permite descargarla antes de continuar.

## Verificación automática y límites

`pnpm test:e2e` comprueba acceso y recuperación visibles. `pnpm test:e2e:journey` ejecuta el recorrido autenticado real en escritorio (1440 × 1000) y móvil (390 × 844), con cursos y correos nuevos, sin mocks. Incluye activación y recuperación por Mailpit, matrícula, preview, publicación confirmada, persistencia, reenvío HTTP 200 con el mismo identificador y un único registro, nueva práctica con otra clave, 404 sin matrícula, aislamiento del borrador, conflicto de revisión 409 y recuperación de una sesión perdida al retirar las cookies reales. Los datos ficticios creados se conservan para inspección.

La suite journey exige `.env.local`, Supabase, PostgreSQL, Mailpit y las cuentas de la semilla; falla explícitamente si faltan. Una ejecución de acceso o una compilación correcta no certifica este recorrido. En el entorno de esta entrega no había Docker/Podman/WSL ni `.env.local`: las pruebas autenticadas están escritas, pero quedan pendientes de ejecución con el backend local. Las capturas `test-results/access-1440.png` y `test-results/access-390.png` solo muestran el acceso sin configurar; no verifican las pantallas autenticadas.

Para reproducir una ejecución contra producción local, realiza primero `pnpm build` y `pnpm start`; la suite reutiliza el servidor en `E2E_BASE_URL`. Si no hay servidor, Playwright inicia `pnpm dev`. Si falta Chromium, instala el navegador de prueba con `pnpm exec playwright install chromium` o usa el canal instalado mediante `PLAYWRIGHT_CHANNEL`. Los fallos conservan captura y traza en `test-results/journey`; revisa sus resultados antes de declarar aprobada la fase.
