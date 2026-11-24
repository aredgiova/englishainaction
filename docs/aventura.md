# English Learning Adventure en la academia

Estado actualizado el 24 de noviembre de 2026. El curso ilustrado requiere sesión y permiso, y guarda el avance por cuenta.

## Entrar a las misiones

Ingresar por `/ingresar` con una cuenta activa. Administración encuentra las dos tarjetas en `/administracion`; docentes y estudiantes habilitados las encuentran en `/docente` y `/campus`. Cada tarjeta abre directamente la misión. El mapa está en `/aventura`.

| Misión | Escenario | Paradas | Preguntas | Ruta |
| --- | --- | --- | --- | --- |
| Hello, Explorer! | Welcome Harbor | 14 | 48 | `/aventura/hello-explorer` |
| My World | Explorer Village | 9 | 30 | `/aventura/my-world` |

La misión 1 adapta las catorce pantallas del documento detallado. La misión 2 desarrolla ejemplos y actividades nuevos desde el esquema conceptual y requiere validación curricular. La correspondencia con las fuentes está en [adventure-source/source-map.md](adventure-source/source-map.md).

## Administrar el acceso

1. Ingresar como administración y abrir «Administrar acceso» o «Quién puede entrar».
2. Buscar por nombre o correo, y filtrar por docentes o estudiantes si hace falta.
3. Elegir «Permitir acceso» o «Retirar acceso». El permiso afecta a ambas misiones.

La activación inicial elegida fue **todos los docentes y estudiantes activos al aplicar la migración**. Las cuentas nuevas necesitan permiso manual. Administración tiene acceso con su cuenta activa; las cuentas inactivas no pueden entrar aunque conserven un permiso. Retirarlo conserva el avance, y habilitarlo de nuevo permite recuperarlo.

El servidor verifica sesión y permiso al abrir mapa o misión y al leer, guardar o reiniciar progreso. Una cuenta sin permiso no recibe el contenido de las rutas protegidas y sus operaciones de progreso se deniegan. Si se retira el permiso con una misión abierta, la siguiente operación de progreso lo comprueba y muestra una salida al panel; esto no borra el contenido ya entregado al navegador.

## Práctica y progreso

- Recorrido libre entre paradas, opción única, feedback y reintentos.
- Vocabulario y diálogos con voz del dispositivo, reproducción, detención, velocidad en escucha y transcripciones.
- Ensayo oral con modelo y autoevaluación; texto libre con modelo de escritura.
- Paradas completadas en el servidor por cuenta y misión, recuperables desde otra sesión o dispositivo. «Reiniciar recorrido» borra solo el avance de esa misión para la cuenta actual.
- La interfaz avanza después de confirmar el guardado; un error permite reintentar y no se presenta como progreso guardado.
- Recompensa narrativa al completar las paradas. Una respuesta incorrecta no impide continuar después de comprobarla. El recorrido no certifica dominio lingüístico.

Se guardan identificadores de paradas asociados a cuenta, misión y fecha de finalización. Los textos escritos se pierden al cambiar de parada y no se envían a la aplicación. No se graba el micrófono, no se guardan ensayos orales y no se califica automáticamente pronunciación ni escritura. El audio depende de las voces y capacidades del navegador; la transcripción permanece disponible si falla.

Las tablas privadas de permiso y progreso tienen RLS activada y no permiten acceso directo a los roles de cliente. Las RPC verifican identidad y rol del perfil persistido; el usuario no elige la cuenta cuyo progreso modifica.

## Relación con los cursos de autoría

La aventura está integrada y conserva sus ilustraciones e interacciones. El docente no necesita crear un borrador, importar una plantilla, publicar ni matricular a estudiantes en otro curso para que puedan usarla: administración habilita sus cuentas. El antiguo botón «Crear borrador con los dos módulos» se retiró del panel docente.

El motor de cursos genéricos conserva editor, revisiones, publicaciones y matrículas. Su progreso por lecciones y aciertos está separado del recorrido de las 23 paradas. La verificación de la plantilla antigua queda como evidencia histórica en [verificacion-aventura-2026-11-24.md](verificacion-aventura-2026-11-24.md).

## Identidad y límites

Acceso, recuperación y definición de contraseña comparten Welcome Harbor: imagen protagonista, Nunito local, formulario breve y acción ámbar. Las tarjetas de los tres roles muestran las dos ilustraciones originales existentes. El resto de los paneles conserva su diseño operativo.

Quedan pendientes validar My World y el primer grupo de grados, adaptar lectura por edad, producir audios interpretados, desarrollar arrastre y escenas interactivas, y definir rúbricas y revisión docente de las cuatro habilidades. Los ejercicios de arrastre y ordenación están adaptados a selección de respuestas. No se añadió Moodle ni se sustituyó la arquitectura de la plataforma.

## Verificación actual

TypeScript, ESLint, OpenAPI y compilación de producción aprobaron. Pasaron 118 pruebas, incluidas 35 de base de datos, y siete de navegador: tres de acceso ilustrado con autenticación simulada, una de permisos multirrol y progreso contra Supabase remoto, y tres de misiones completas. Las revisiones independientes visual y de código aprobaron sin hallazgos materiales.

Comandos, evidencias y límites: [verificacion-acceso-2026-11-24.md](verificacion-acceso-2026-11-24.md). La entrega está publicada en [la academia](https://englishainaction.vercel.app/ingresar), con comprobación de ambos módulos desde los tres roles en producción.
