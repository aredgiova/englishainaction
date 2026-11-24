---
name: English in Action
description: Academia operativa con acceso y misiones en el mundo ilustrado de The Discovery Islands.
colors:
  academy-primary: "#096b5c"
  academy-navigation: "#173b40"
  academy-background: "#f4f5ef"
  academy-ink: "#19343b"
  adventure-ink: "#153e49"
  adventure-muted: "#4c686e"
  adventure-teal: "#087267"
  adventure-gold: "#fbd365"
  adventure-background: "#f6faf7"
  adventure-soft: "#e6f1e8"
  paper: "#fff"
  auth-focus: "#a06300"
typography:
  academy-body:
    fontFamily: "Arial, Segoe UI, sans-serif"
    fontSize: "15px"
    lineHeight: 1.55
  adventure-body:
    fontFamily: "Nunito, sans-serif"
    fontSize: "16px"
  auth-title:
    fontFamily: "Nunito, sans-serif"
    fontSize: "clamp(30px, 2.6vw, 38px)"
    fontWeight: 850
    lineHeight: 1.15
rounded:
  academy-control: "8px"
  adventure-control: "9px"
  academy-panel: "12px"
  adventure-panel: "16px"
components:
  auth-primary:
    backgroundColor: "{colors.adventure-gold}"
    textColor: "#173d45"
    rounded: "{rounded.adventure-control}"
    padding: "14px 19px"
  academy-primary:
    backgroundColor: "{colors.academy-primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.academy-control}"
    padding: "10px 17px"
---

# English in Action — sistema visual

## Overview

**Creative North Star: "The Discovery Islands"**

El acceso y el curso ilustrado comparten un mundo de exploración amable: puerto, aldea, personajes tridimensionales, escenas tropicales y llaves de mapa. La imagen presenta ese mundo y el texto breve orienta la siguiente acción. Esta dirección, solicitada por el usuario, abarca acceso, recuperación, definición de contraseña, aventura y tarjetas de misión en los tres paneles.

La academia conserva el espacio de trabajo operativo: navegación consistente, listas con estados reales, formularios y acciones próximas al contenido. Las tarjetas de aventura se integran en ese marco sin sustituir el editor, los cursos de autoría ni la gestión de cuentas.

**Key Characteristics:**

- Dos ilustraciones originales existentes: `public/adventure/welcome-harbor.png` y `public/adventure/explorer-village.png`.
- Nunito local, superficies claras y acción ámbar en las superficies ilustradas.
- Texto explícito para permiso, guardado, error y progreso.
- Presentación adaptada a escritorio y móvil; adaptación pedagógica por grados pendiente.

Los documentos y fotografías de referencia están inventariados en [el mapa de fuentes](docs/adventure-source/source-map.md). Las fotografías de pantallas no se usan como recursos de producción.

## Colors

Los tokens anteriores se extraen de `src/app/globals.css`, `auth.module.css`, `adventure-catalog.module.css` y `adventure/adventure.module.css`. La academia usa petróleo para acciones, marino para navegación y marfil tenue de fondo. El mundo ilustrado usa tinta azul verdosa, turquesa, ámbar y verde jardín claro. El ámbar identifica la acción principal de acceso y avance; el color siempre va acompañado de texto o estado accesible.

El formulario usa blanco, contorno verde tenue y foco ocre. El catálogo cambia el fondo del indicador «Entrar» a ámbar al pasar el puntero. Las alertas conservan los colores semánticos y mensajes del sistema operativo.

## Typography

Nunito variable se aloja en `public/fonts/nunito-variable.ttf`, con su licencia, y se carga con `next/font/local`. Su alcance está aislado mediante variables de fuente de acceso, catálogo y aventura. El resto de la academia conserva las fuentes del sistema.

El acceso usa título de formulario de 30–38 px, descripción de 16 px y etiquetas de 14 px con peso 800; en móvil la descripción baja a 14 px. La escena contiene un saludo grande de peso 900. El catálogo usa títulos de misión de 25 px. En aventura, la portada escala entre 40 y 65 px; la parada usa 34 px y 28 px en móvil. Las etiquetas pequeñas complementan las instrucciones.

## Layout

El acceso coloca una escena a la izquierda y marca y formulario a la derecha. El formulario tiene ancho máximo de 390 px. A 760 px o menos se apilan marca, escena de 205 px y formulario, con una sola acción principal visible. Recuperación y definición de contraseña reutilizan la misma composición.

La academia conserva contenido de hasta 1220 px y lateral de 232 px en escritorio; en móvil utiliza barra compacta y enlaces horizontales. Las tarjetas de misión forman dos columnas, con separación de 24 px; a 700 px o menos se apilan. El gestor de acceso tiene búsqueda, filtro de rol y filas de personas; en móvil el botón de cada fila ocupa el ancho disponible.

La aventura conserva portada de hasta 1440 px, reproductor de hasta 1320 px y ruta lateral de 255 px. A 760 px o menos la ruta se transforma en una fila desplazable. Los textos largos de actividad se limitan aproximadamente a 70 caracteres por línea.

## Elevation & Depth

Las ilustraciones aportan la profundidad principal. Los paneles operativos se delimitan con bordes finos; tarjetas y actividades ilustradas tienen sombras suaves. El catálogo usa `0 6px 24px #173b4012`. Los degradados se limitan a las escenas para dar contraste al texto o unir el paisaje con su fondo.

El revelado de la imagen de acceso dura 800 ms y solo se aplica si no se solicita movimiento reducido. El movimiento no bloquea el formulario ni comunica por sí solo un estado.

## Shapes

Los paneles ilustrados usan esquinas de 16 px; los campos y acciones ilustrados, 9 px. La escena de acceso pasa a 12 px en móvil. La academia mantiene radios de 12 px para superficies y 8 px para controles. Círculos identifican paradas, controles de audio y recompensas; las opciones mantienen contornos legibles.

## Components

**Acceso.** Marca compacta con brújula, imagen Welcome Harbor y formulario breve. «Tu aventura continúa.» introduce correo y contraseña. Las etiquetas permanecen visibles; el control de mostrar contraseña anuncia su estado. Se conservan autocompletado, recuperación, confirmación de contraseña, espera, errores y enlace para saltar al formulario. El envío correcto lleva al panel del rol. El fallo conserva los campos y permite reintentar.

**Catálogo.** Cada tarjeta completa enlaza a una misión y muestra imagen, nombre, descripción breve, escenario y «Entrar». Administración ve además «Administrar acceso». Docentes y estudiantes ven tarjetas y navegación de aventura solo cuando el servidor confirma su permiso.

**Control de acceso.** «Quién puede entrar» muestra nombre, correo, rol y estado. El botón permite o retira acceso individual; las cuentas inactivas se identifican y no pueden operarse desde ese control. El resultado se anuncia con texto y recuerda que el avance se conserva.

**Reproductor.** La ruta distingue selección y finalización. Cada parada presenta contexto, instrucción, práctica y avance. El guardado confirmado actualiza el progreso por cuenta; los errores y la retirada de permiso tienen salida visible. La recompensa reconoce recorrido, no dominio lingüístico. Voz del dispositivo, transcripciones, modelos y autoevaluación mantienen disponibles alternativas al audio.

**Academia.** Listas editoriales distinguen borrador y publicación. Los diálogos nativos de vista previa y publicación contienen el foco y lo devuelven al control anterior. La edición conserva recuperación de sesión y respaldo descargable ante conflictos. Los cursos genéricos mantienen su progreso y aciertos separados.

## Do's and Don'ts

- **Do** conservar el mundo ilustrado en acceso, aventura y tarjetas, y el marco operativo del resto de los paneles.
- **Do** usar las ilustraciones originales, instrucciones breves y feedback que permita reintentar.
- **Do** mostrar los estados persistidos de permiso y guardado y mantener foco visible, etiquetas y mensajes accesibles.
- **Don't** presentar llaves, paradas completadas o autoevaluación como certificación de aprendizaje.
- **Don't** afirmar adaptación para todos los grados, audio grabado o evaluación automática de pronunciación.

La evidencia actual está en `docs/evidencia/auth/` y `docs/evidencia/access/`; la revisión independiente aprobó acceso, recuperación y paneles de los tres roles sin hallazgos materiales. Alcance y pruebas: [verificación de acceso](docs/verificacion-acceso-2026-11-24.md). El [informe previo de aventura](docs/verificacion-aventura-2026-11-24.md) se conserva como registro histórico.
