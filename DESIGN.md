# English in Action — sistema visual

## Dirección
Un espacio de trabajo académico: la navegación orienta, las listas muestran el estado real y la siguiente acción permanece cerca del contenido. El diseño sirve la práctica y la gestión. La marca aparece en una firma tipográfica compacta y un símbolo geométrico de diálogo.

## Contexto de uso
Estudiantes y docentes trabajan en pantallas móviles o de escritorio, en aulas y espacios de estudio con luz diurna. La interfaz usa superficies claras, contraste alto y controles legibles.

## Sistema de la academia
- Superficie de página marfil tenue, paneles blancos, navegación azul marino y acciones verde petróleo. Las alertas usan colores semánticos con texto explícito.
- Fuentes del sistema: Arial, Segoe UI, sans-serif. Escala fija, encabezados principales de 32 px; texto 15–16 px; metadatos 12–13 px.
- Contenido con ancho máximo de 1220 px. Navegación lateral de 232 px en escritorio; barra compacta y enlaces horizontales en móvil.
- Bordes finos, radios de 12 px para superficies, 8 px para campos y controles. Sin sombras decorativas, degradados ni imágenes ajenas al contenido.
- Ritmo espacial de 4 px: grupos a 8–16 px, secciones a 24–40 px.
- Estado primario verde petróleo `#096b5c`; navegación `#173b40`; página `#f4f5ef`. Foco visible de 3 px: `#a76b0f` sobre superficies claras y `#efbd65` sobre azul marino; controles nativos para formularios, selección única y edición.

## Patrones
El panel usa listas de cursos con estado editorial o avance. La administración dispone de formularios de invitación y matrícula en secciones independientes. La autoría usa un documento de unidades y lecciones, con acciones de orden explícitas y guardado por revisión. La práctica presenta objetivo, contenido y ejercicio en ese orden. La corrección aparece solo después de entregar y separa aciertos de finalización.

Los destinos de cada rol son `/campus`, `/docente` y `/administracion`. El campus destaca la siguiente lección pendiente y su avance real. Las listas editoriales separan revisión del borrador y disponibilidad de la publicación. La vista previa y la confirmación de publicación usan diálogos nativos, con foco contenido y retorno al control anterior; en móvil, la vista previa ocupa la pantalla. Una sesión caducada presenta un formulario de recuperación dentro del espacio de trabajo, conservando los campos abiertos.

## Accesibilidad y estados
Etiquetas explícitas, `aria-live` para resultados, `role=alert` para errores, estados de espera con acciones deshabilitadas y recuperación clara. Los formularios mantienen los valores tras errores. Los enlaces y botones tienen áreas cómodas en móvil. El contenido nunca depende exclusivamente del color. Se respeta `prefers-reduced-motion`.

Los cambios de autoría se recuperan desde el almacenamiento de sesión, separados por cuenta y curso. La navegación, recarga y cierre de sesión advierten sobre trabajo sin guardar. El cierre de sesión borra las copias locales de esa cuenta. Los errores de publicación identifican la unidad, lección, actividad y campo y permiten enfocarlo.

Ante conflicto de revisión, el editor consulta la versión vigente sin alterar la edición local. Cargarla es una acción explícita que conserva primero copias completas descargables de los cambios anteriores. El respaldo precede a la sustitución; si falla, se conserva el borrador abierto. La reincorporación posterior es manual y el guardado mantiene la comprobación de revisión del servidor.

## Evidencia de revisión
Se inspeccionaron las capturas reales de acceso sin configuración en escritorio de 1440 px y móvil de 390 px, sin recortes ni desbordamiento visible. El detector mecánico no encontró incidencias. La revisión independiente cerró los tres hallazgos de recuperación, localización de errores y contraste de foco. Las pantallas autenticadas y sus interacciones requieren verificación visual con Supabase configurado; no se presentan como verificadas en navegador.

## Procedencia
La academia se inició sin identidad previa. Su paleta y estructura son decisiones de implementación, no afirmaciones del usuario. El sorteo inicial de dirección de Impeccable se ejecutó sin catálogo remoto; no se utilizaron tableros visuales externos. La academia conserva fuentes del sistema. La extensión de aventura utiliza las referencias aportadas posteriormente y los recursos locales descritos a continuación.

# Extensión visual: English Learning Adventure

## Overview

El mundo ilustrado se limita a `/aventura`, `/aventura/hello-explorer` y `/aventura/my-world`. Presenta The Discovery Islands como un recorrido de exploración amable: puerto y aldea, personajes infantiles tridimensionales, escenas tropicales y llaves de mapa. Los paneles de la academia conservan el sistema anterior. Esta primera presentación sirve para revisar los dos módulos; la adaptación visual y lectora por grupos de grados sigue pendiente.

Las dos ilustraciones originales, `public/adventure/welcome-harbor.png` y `public/adventure/explorer-village.png`, siguen las referencias gráficas del usuario. Los documentos y las fotografías de referencia están inventariados en [el mapa de fuentes](docs/adventure-source/source-map.md); las fotografías de pantallas no se usan como recursos de producción.

## Colors

La fuente de verdad es `src/components/adventure/adventure.module.css`. Texto azul marino verdoso `--ad-ink: #153e49`, texto secundario `--ad-muted: #4c686e`, turquesa `--ad-teal: #087267`, ámbar `--ad-gold: #fbd365` y foco `--focus: #ad6900`. El fondo general es `#f6faf7`; los paneles son blancos y la guía usa verde jardín pálido `#e6f1e8`. La portada coloca texto blanco sobre `#143f48`. El ámbar identifica la acción principal; verde claro y texto explícito acompañan aciertos, y amarillo pálido acompaña pistas de reintento.

## Typography

Nunito variable se aloja en `public/fonts/nunito-variable.ttf` y se carga con `next/font/local`, limitada a la extensión mediante `--adventure-font`; su licencia acompaña el recurso. El cuerpo parte de 16 px, con instrucciones de 15 px y textos de práctica de 15–17 px. Los títulos usan peso 850. El título de portada escala entre 40 y 65 px; en móvil usa 45 px. El título de parada pasa de 34 a 28 px. Las etiquetas pequeñas son información complementaria y no sustituyen instrucciones.

## Layout

La portada tiene un máximo de 1440 px y dos columnas, texto e ilustración. El catálogo dispone dos tarjetas de misión; el reproductor, una ruta lateral de 255 px y un panel de actividad. A 760 px o menos, la portada y las tarjetas forman una columna, y la ruta se convierte en una fila horizontal desplazable. El reproductor usa un máximo de 1320 px; las actividades mantienen ancho flexible y el texto largo se limita a 70 caracteres aproximados por línea.

## Elevation & Depth

Las ilustraciones proporcionan la profundidad principal. Tarjetas y paneles usan sombras suaves; la etiqueta sobre la escena lleva una sombra más visible para separarse del paisaje. Un degradado une la ilustración de portada con su fondo oscuro en escritorio. La animación de revelado de la escena solo se aplica si el usuario no solicita movimiento reducido.

## Shapes

Tarjetas y paneles principales tienen radios de 16 px; bloques de actividad, 12 px; acciones y respuestas, 9 px. Números de parada, controles de audio y la recompensa emplean círculos. Los contornos finos delimitan opciones, vocabulario y escucha.

## Components

La tarjeta completa enlaza a una misión. La ruta permite volver a cualquier parada y distingue selección y finalización. Cada actividad presenta contexto, instrucción, práctica y acción de avance; la comprobación muestra aciertos y pistas y admite reintentos. El avance conserva únicamente los identificadores de paradas completadas en este navegador. La recompensa reconoce recorrido, no dominio del idioma.

Los controles de escucha usan la voz del dispositivo, permiten detenerla y ofrecen transcripción en las actividades de escucha. Habla y escritura incluyen modelos y autoevaluación. Se conservan controles nativos, nombres accesibles, enlace para saltar al contenido, foco al cambiar de parada y mensajes de resultado y error. No se graba audio ni se califica automáticamente la producción oral o escrita.

## Do's and Don'ts

- Mantener esta dirección visual dentro de la aventura y preservar la interfaz operativa de la academia.
- Usar personajes e ilustraciones originales coherentes con las fuentes, instrucciones breves y feedback que permita volver a intentar.
- Identificar el contenido en revisión y distinguir el recorrido local del progreso institucional.
- No presentar las llaves, las paradas completadas ni la autoevaluación como certificación de aprendizaje.
- No afirmar adaptación para todos los grados, audio grabado o evaluación automática de pronunciación.

La evidencia en `docs/evidencia/adventure/` incluye portada y misión a 1440 y 390 px. La verificación funcional documentada en [docs/aventura.md](docs/aventura.md) cubre ambos recorridos, respuestas, reinicio, recuperación local, controles de voz y ausencia de desbordamiento. La importación real se comprobó con cuentas ficticias existentes y Supabase remoto, incluida la persistencia privada del borrador y el funcionamiento de la vista previa con teclado y a 390 px. El borrador de prueba se eliminó sin publicarlo. Esta comprobación funcional no incluye una inspección visual de capturas autenticadas ni uso de cuentas institucionales reales. Los estados de fallo y reintento también se comprobaron con dobles de la API.
