# English in Action — sistema visual

## Dirección
Un espacio de trabajo académico: la navegación orienta, las listas muestran el estado real y la siguiente acción permanece cerca del contenido. El diseño sirve la práctica y la gestión. La marca aparece en una firma tipográfica compacta y un símbolo geométrico de diálogo.

## Contexto de uso
Estudiantes y docentes trabajan en pantallas móviles o de escritorio, en aulas y espacios de estudio con luz diurna. La interfaz usa superficies claras, contraste alto y controles legibles.

## Sistema
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
Repositorio sin identidad previa. Paleta y estructura son decisiones de implementación, no afirmaciones del usuario. El sorteo de dirección de Impeccable se ejecutó sin catálogo remoto; no se utilizaron tableros visuales externos. No se requieren recursos de imagen ni fuentes remotas.
