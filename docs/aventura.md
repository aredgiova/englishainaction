# Primeros módulos de English Learning Adventure

Versión inicial implementada el 24 de noviembre de 2026 en la plataforma existente.

## Revisar el recorrido

Con `pnpm dev` activo, abrir `http://127.0.0.1:3000/aventura`.

| Misión | Escenario | Paradas | Preguntas |
| --- | --- | --- | --- |
| Hello, Explorer! | Welcome Harbor | 14 | 48 |
| My World | Explorer Village | 9 | 30 |

Las dos rutas de misión son `/aventura/hello-explorer` y `/aventura/my-world`. El laboratorio es público y contiene prácticas con soluciones para revisión; no es un examen ni accede a cursos privados.

La misión 1 adapta las catorce pantallas del documento detallado. La misión 2 contiene diálogos, ejemplos y actividades nuevos basados en el esquema conceptual; queda pendiente de validación curricular. Las decisiones y la correspondencia exacta con las fuentes están en [adventure-source/source-map.md](adventure-source/source-map.md).

## Qué funciona

- Recorrido libre entre paradas, respuestas de opción única, feedback y reintentos.
- Vocabulario y diálogos con voz del dispositivo, control de reproducción, velocidad en escucha y transcripciones.
- Ensayo oral con modelo y autoevaluación; texto libre con modelo de escritura.
- Recuperación local de las paradas completadas, separada por misión. Solo se almacena una lista de identificadores; los textos escritos se pierden al cambiar de parada y no se envían al servidor.
- Recompensa narrativa al recorrer todas las paradas. Una respuesta incorrecta no impide continuar después de comprobarla. El recorrido no mide ni certifica dominio lingüístico.
- Dos ilustraciones originales y coherentes con las referencias; fuente Nunito alojada localmente con su licencia.

El audio depende de las voces y capacidades del navegador. La transcripción está disponible aunque la reproducción falle. No se graba el micrófono y no se califica pronunciación ni escritura automáticamente.

## Cargar el contenido en la academia

1. Ingresar con una cuenta docente y abrir `/docente`.
2. Usar «Crear borrador con los dos módulos».
3. Revisar el curso creado: nivel A1, público escolar, dos unidades y dieciséis lecciones.
4. Ajustar el contenido y publicar desde el editor cuando corresponda.

La plantilla utiliza el formato que ya admite la academia: texto y preguntas de opción única. Agrupa escenas y tareas de producción con lecciones de práctica. Conserva los guiones de escucha, pero las imágenes y las interacciones del laboratorio no se transfieren al curso publicado. La plantilla conserva la evaluación oral y escrita como tareas que requieren revisión docente. Crear el borrador no publica ni matricula estudiantes.

Si falla el guardado tras crear el curso, el botón retoma ese mismo borrador. Si la respuesta de creación es ambigua, pide revisar la lista y evita repetir la creación. Un conflicto de revisión conserva los cambios existentes.

## Pendientes para una versión institucional

- Validar el temario detallado de My World y seleccionar el primer grupo de grados.
- Adaptar lectura e instrucciones a los grupos de edad. Esta primera versión usa una única presentación de aventura.
- Producir audios interpretados y recursos visuales específicos de cada actividad.
- Desarrollar los juegos de arrastrar etiquetas, ordenar diálogos y escenas con objetos interactivos; la versión inicial adapta esos ejercicios a selección de respuestas.
- Integrar imágenes, actividades multimedia, progreso por cuenta y rúbricas de las cuatro habilidades en el formato persistente de la academia.

No se añadió Moodle ni se sustituyó la arquitectura de la plataforma: las menciones a tecnologías en los documentos se trataron como propuestas de referencia.

## Verificación

Se ejecutaron TypeScript, ESLint, la compilación de producción y 93 pruebas, incluidas 26 de integración con PostgreSQL embebido. La plantilla real se guardó, publicó y corrigió íntegramente en esa base aislada: 78 respuestas y avance final de 16/16 lecciones. `pnpm test:e2e:adventure` aprobó tres pruebas que verifican ambos recorridos completos, respuestas, reinicio, recuperación local, ausencia de textos personales en el almacenamiento, presentación a 1440 y 390 px y reproducción/detención/error del modelo oral con la API de voz simulada. Usa Edge instalado de forma predeterminada; `PLAYWRIGHT_CHANNEL` permite seleccionar otro navegador compatible.

`pnpm test:e2e:adventure:hosted` aprobó una prueba de importación real desde el panel docente, usando cuentas ficticias existentes y Supabase remoto. Verificó el borrador privado con dos unidades y dieciséis lecciones, revisión persistida, reapertura sin duplicados, vista previa en escritorio/móvil y rechazo del acceso como estudiante. Después eliminó únicamente el borrador de prueba, sin publicarlo. Los estados de fallo y reintento también se probaron con dobles de la API. No se usaron cuentas institucionales reales ni se desplegó la web. El alcance detallado está en [verificacion-aventura-2026-11-24.md](verificacion-aventura-2026-11-24.md); las capturas de revisión están en `docs/evidencia/adventure/`.
