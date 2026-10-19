# Appear Writer · Producto

Este documento describe qué hace la app y cómo se comporta en cada pantalla. Para instalarla o desplegarla, mira el [README](../README.md).

## 1. Qué es

Appear Writer es una web app de uso personal con dos estudios:

- **Imágenes:** convierte una frase, o muchas a la vez, en imágenes para Instagram y Facebook.
- **Libros:** convierte chats de WhatsApp, documentos o textos pegados en un libro maquetado, listo para imprimir o leer en un lector.

Funciona entera **sin IA y sin ninguna key**. La IA y los bancos de fotos son extras que se activan aparte.

## 2. Principios de comportamiento

Estas reglas se cumplen en toda la app:

1. **Tú decides todo.** Antes de crear nada, todas las opciones están a la vista, ya rellenas con un valor sugerido. Lo sugerido lleva un punto ámbar (●) y puedes cambiar cualquier opción.
2. **Nada se aplica sin que lo veas.** Ni el sistema ni la IA cambian una opción o tu texto por su cuenta.
3. **La IA es opcional y viene apagada.** Cada ayuda de IA tiene su propia casilla o botón. Lo que hace la IA se guarda aparte del original, y al desmarcar la casilla se quita.
4. **El texto siempre sale nítido.** La letra la dibuja el navegador, nunca la IA.
5. **Lo mismo que ves es lo que descargas.** La vista previa y el archivo final salen del mismo diseño. Un patrón aleatorio se dibuja igual en la vista previa, en el PNG y en una plantilla guardada.
6. **El original no se toca.** Las correcciones, los títulos de la IA y los ajustes se aplican al maquetar. Las fuentes que subes quedan intactas.

## 3. Navegación general

- **Cabecera:** dos pestañas, **Imágenes** y **Libros**, y dos accesos, **Galería** y **Ajustes**.
- **Acceso:** si el servidor tiene `APP_PASSWORD`, el navegador pide esa contraseña antes de entrar.
- **Estructura de los estudios** (Imágenes y Libros comparten la misma):
  - **Columna izquierda:** los pasos, con scroll propio.
  - **Barra de pasos arriba:** marca con ✓ los terminados; al pulsar uno, la columna baja hasta ese paso.
  - **Botón principal fijo al pie** de la columna izquierda: *Crear propuestas* o *Generar libro*.
  - **Columna derecha:** la vista previa. Nunca se mueve.
- **Secciones de opciones plegables:** cada título muestra a la derecha lo que hay elegido (por ejemplo, «Fondo ● El del estilo · Textura · Patrón»). Así se lee el panel entero sin abrir nada. Solo la primera sección viene abierta.
- **«Volver a lo sugerido»:** devuelve todas las opciones a sus valores base.
- **Atajos:** el botón «? Atajos» de la barra de pasos (o la tecla ?) abre un panel con todos los atajos y controles del estudio. Se abre encima, sin modal, y se cierra con ? o Esc sin perder lo que estás editando.
- **Móvil:** las columnas se apilan. La vista previa sube arriba y se queda fija mientras bajas por las opciones, y el botón principal sigue fijo abajo.

## 4. Estudio de Imágenes

### Paso 1 · Tu texto

Hay dos modos, **Una frase** y **Lote**.

En **Una frase** escribes o pegas el texto. Debajo aparece su lectura: caracteres, palabras, longitud (corta, media, larga, muy larga) y el formato sugerido. El formato se sugiere así:

| Longitud del texto | Formato sugerido |
| --- | --- |
| Hasta 60 caracteres | 4:5 con letra gigante |
| Hasta 220 caracteres | 4:5 o 1:1 con letra media |
| Más de 220 caracteres | Carrusel, con unos 140 caracteres por imagen y hasta 10 imágenes |

En **Lote** escribes muchas frases separadas por una línea en blanco (ver el apartado *Lote*).

### Paso 2 · Opciones

| Sección | Qué decide | Valor sugerido |
| --- | --- | --- |
| Formato | 4:5 post, 1:1 cuadrado, 9:16 historia o carrusel (con imágenes 4:5 o 1:1). Exportar en doble resolución (2160 px de ancho). | Según la longitud · doble resolución activada |
| Estilos | Familias que entran en las propuestas: bold editorial, color vivo, minimalista y artístico. Siempre queda al menos una. | Las 4 |
| Tipografía | Una fuente fija para todas o «Que decida cada estilo». | Que decida cada estilo |
| Paleta | Una paleta fija o «Que decida cada estilo». | Que decida cada estilo |
| Fondo | Los que se alternan entre propuestas: el del estilo, color plano, degradado, textura, patrón generativo, foto y fondo IA. | El del estilo · Textura · Patrón |
| Patrones | Qué patrones generativos se pueden usar y cómo (ver *Patrones generativos*). | 7 patrones · uno al azar · intensidad media |
| Mis plantillas | Plantillas guardadas que entran primero en las propuestas. | Ninguna |
| Marca personal | Firma, logo, paleta de marca y fuente de marca (se configuran en Ajustes). | Firma, si tienes una configurada |
| Extras | Guardar en la galería, texto de publicación y hashtags. | Guardar en la galería |
| Ayuda de la IA | Sugerir estilo según el tono del texto. | Apagada |

Además:

- Si el texto es largo y no eliges carrusel, un aviso indica que la letra saldrá pequeña.
- Los fondos que necesitan algo que falta aparecen desactivados con su motivo: el fondo IA pide una key de OpenAI. El fondo *Foto* siempre está disponible, porque puedes subir tu propia foto.

### Propuestas y vista previa

- **Crear 4 propuestas:** genera cuatro diseños distintos, alternando los estilos, paletas y fondos marcados.
- **La vista previa:** la propuesta elegida se ve en grande a la derecha y las cuatro aparecen como miniaturas a su lado, con número y nombre.
- **Botones sobre la vista previa:**
  - **Aleatorio:** cambia la propuesta elegida por un diseño al azar. Solo usa lo marcado en el panel y cambia la paleta y la letra solo si están en «que decida cada estilo».
  - **Anterior:** vuelve al diseño de antes. Aparece solo cuando hay algo que deshacer.
  - **Guardar plantilla:** guarda la propuesta en *Mis plantillas*. Si ya está guardada, el botón dice «Guardada» y al pulsarlo se quita.
  - **Descargar PNG:** baja la imagen, o un ZIP si es un carrusel.
- **Botones del pie:** **Crear otras 4 propuestas** y **4 al azar** (cuatro diseños aleatorios de golpe).
- **Bajo la imagen:** el tamaño final en píxeles y el crédito de la foto, si la hay.
- **Atajos de teclado** (cuando no estás escribiendo en un campo):

  | Tecla | Acción |
  | --- | --- |
  | ← → | Cambiar de propuesta |
  | R | Diseño al azar |
  | Ctrl+Z | Volver al anterior |

### Paso 3 · Ajuste fino

Aparece en la columna izquierda en cuanto hay una propuesta elegida. Los cambios se ven al momento en la vista previa y en su miniatura.

- **Paleta:** botones de color.
- **Tipografía:** la del estilo o cualquier otra.
- **Tamaño de letra:** del 60 % al 130 %.
- **Fondo:**
  - Con **patrón**: elegir hasta 3 capas entre los tipos marcados, «Otra variación» (nueva semilla), intensidad, tamaño del patrón y emojis.
  - Con **foto**: tus fotos subidas y, si hay keys, búsqueda en Unsplash o Pexels.
  - Con **fondo IA**: una idea opcional y el botón para generarlo.
- **Destacar:** palabras resaltadas, separadas por comas. Por defecto, las que propone la lectura del texto.
- **Etiqueta corta:** opcional, por ejemplo «Lunes · Regla nº 3».

### Texto para la publicación

Aparece en el paso 3 si marcas *Texto de publicación* o *Hashtags* en Extras. Funciona sin IA:

- **Estilos:** Reflexión ● (la frase y una pregunta), Para guardar (invita a guardar o compartir) y Breve (la frase y la firma).
- **Otra versión:** cambia la frase final dentro del mismo estilo.
- **Hashtags:** salen de las palabras con más peso del texto, sin palabras vacías ni tildes, más `#frases`. Como máximo 8.
- **Firma:** se añade si la firma de marca está activada.
- **Edición:** el texto y los hashtags se pueden editar a mano. Un indicador dice si son de la plantilla, editados por ti o escritos por la IA. «Volver a la plantilla» deshace los cambios.
- **Copiar** lleva todo al portapapeles. En un carrusel, el ZIP incluye además un `texto.txt`.
- **IA:** si hay una key, el botón «Escribirlo con IA» pide una versión a la IA. Es siempre una acción tuya.

### Lote

1. Escribes las frases separadas por una línea en blanco.
2. A la derecha ves todas las imágenes que saldrán. Cada frase usa el formato que sugiere su longitud, salvo que elijas un formato fijo.
3. Al pulsar una imagen se abre su **ajuste fino** en la columna izquierda:
   - Cambiar paleta, tipografía, tamaño, fondo y patrón.
   - **Al azar:** otro diseño para esa frase.
   - **Quitar el ajuste:** vuelve al diseño automático.
   - **Listo:** cierra el ajuste.
4. Las imágenes ajustadas llevan la marca «ajustada».
5. **Generar N imágenes (ZIP)** descarga todas, con los ajustes aplicados. Si marcaste texto o hashtags, cada imagen lleva su `.txt` con un cierre distinto.

En el lote no se usan fondos de foto ni fondo IA, porque la foto sería la misma para todas.

### Patrones generativos

Se dibujan con la paleta elegida, sin IA y sin conexión. Hay 19 tipos en cuatro grupos:

| Grupo | Tipos |
| --- | --- |
| Geométricos | Truchet, Bauhaus, Triángulos, Semitono, Franjas, Confeti |
| Funciones matemáticas | Campo de flujo, Lissajous, Espirógrafo, Curva rosa, Ondas, Curvas de nivel, Voronoi, Árbol fractal |
| Emojis | Rejilla de emojis, Emojis dispersos |
| ASCII | ASCII de ruido, ASCII de ondas, Lluvia de código |

- **Solo los tipos marcados** entran en la generación. Siempre queda al menos uno, y cada grupo tiene «Marcar todos» o «Quitar todos».
- **Uno o varios:** «Un patrón al azar» elige uno de los marcados en cada imagen. «Varios superpuestos» combina 2 o 3 en la misma imagen.
- **Intensidad:** suave, media o fuerte.
- **Emojis:** si tu texto tiene emojis, se sugieren esos y se marcan los dos tipos de emojis.
- **Variación por imagen:** en un carrusel, cada imagen tiene una variación distinta del mismo patrón.

### Mis plantillas

- **Guardar:** el botón «Guardar plantilla» guarda la combinación completa (plantilla, paleta, letra, fondo, patrón exacto y tamaño de letra).
- **La lista:** se muestra en el panel con una miniatura hecha con tu texto actual. Puedes renombrar (clic en el nombre), borrar y marcar cuáles usar.
- **Usarlas:** «Proponer con las marcadas» crea propuestas que empiezan por esas plantillas.
- Se guardan en el servidor, así que siguen ahí al cerrar el navegador.

## 5. Estudio de Libros

### Paso 1 · Fuentes

- **Qué puedes añadir:** chats de WhatsApp (.txt, o .zip con fotos; de Android o iOS, en español o inglés), .docx, .pdf, .txt, .md o un texto pegado con título opcional.
- **Cómo:** arrastras los archivos o los eliges. Puedes añadir varias fuentes y ordenarlas con ↑ ↓; para quitar una se pide confirmación.
- **Cada fuente** muestra un resumen, por ejemplo «WhatsApp · 5 mensajes · 2 fotos».
- **El libro se recuerda:** al volver a la página se abre el último libro. «Empezar otro libro» deja uno nuevo en blanco.

### Paso 2 · Contenido

Aquí decides qué pasa con cada mensaje (o párrafo) antes de exportar. El original de las fuentes nunca se toca: lo que decides se guarda aparte y se aplica al maquetar la vista previa, el PDF, el EPUB y los PNG. Ctrl+Z deshace la última decisión.

**La lista**

- Muestra los mensajes agrupados por capítulo, tal como quedarán, incluidos los ocultos (tachados y en gris) y las páginas que añadas (filas propias con «+»).
- Cada fila lleva sus etiquetas: Oculto, ★ Cita / ★ Foto, Capítulo, N fotos, editado.
- Un resumen arriba: «712 mensajes · 94 ocultos · 4 destacados · 1 texto editado».
- **Filtros:** búsqueda (sin importar tildes), persona, desde/hasta, con fotos y estado (todos, ocultos, destacados, editados). «Quitar filtros» los limpia.
- **Selección múltiple:** casillas, Mayús + clic marca un tramo y la casilla de arriba marca todo lo que se ve. La barra lila permite Ocultar, Destacar y, en «Más», Mostrar, Quitar el destacado o Restablecer.
- La lista solo pinta las filas visibles, así que funciona con chats de miles de mensajes.
- **Plegar:** el botón «Plegar» del título del paso deja solo el resumen en una línea, para llegar rápido a las opciones. Se despliega al tocar el resumen, «Desplegar» o «Contenido» en la barra de pasos. La app recuerda en ese navegador si lo dejaste plegado.

**Elegir un mensaje.** Con un clic en la lista o directamente en la vista previa, se abre su **ficha** en la columna izquierda (la vista previa no se tapa) y el mensaje queda con un contorno lila en el libro. Si el mensaje cae fuera de las páginas que muestra la vista previa, esta se recarga centrada en él.

**La ficha del mensaje**

| Parte | Qué hace |
| --- | --- |
| Cabecera | Autor, fecha y página; ‹ › pasan al mensaje anterior o siguiente («334 de 712»). |
| Ocultar (H) | El mensaje no entra en el libro. Se puede volver a mostrar. |
| Destacar (D) | Aplica el diseño Cita directamente. |
| Capítulo aquí | Empieza un capítulo en este mensaje, con título y subtítulo. Usa el diseño de apertura del libro y entra en el índice; la regla automática sigue en el resto. Si es el primer mensaje del capítulo, lo renombra. |
| Diseño de la página | Normal ●, Cita, Foto completa (texto en la página siguiente ● o sobre la foto con un velo del color profundo) y Foto + texto (una o dos fotos enmarcadas con el texto debajo). Los de foto solo se activan si el mensaje tiene fotos. |
| Fotos | Miniaturas con × para quitar cada foto (↺ para volver a ponerla) y dónde van: Junto ●, Página antes (una página solo con las fotos y el mensaje después) o Ambas. |
| Texto | Editor con formato: negrita, cursiva, subrayado, letra (las cuatro del libro), tamaño, color de la paleta, alineación y quitar formato. Sobre la palabra o frase seleccionada; sin selección, sobre todo el texto. «Volver al original» deshace la edición. |
| Página antes / después | Añade una página junto al mensaje. |
| Restablecer este mensaje | Quita todo lo decidido sobre él. |

Atajos en la ficha (también con el foco en la vista previa): ← → cambian de mensaje, H oculta, D destaca, Esc vuelve a la lista.

**Páginas añadidas**

| Tipo | Cómo se ve |
| --- | --- |
| Separador | Ornamento, título y una línea pequeña opcional. Es solo decorativo: no abre capítulo ni entra en el índice (para eso está «Capítulo aquí»). |
| Página libre | Tu texto, con el mismo editor de formato; una línea en blanco separa párrafos. |
| Imagen | Una de tus fotos subidas, a página completa (●) o enmarcada con pie. |
| En blanco | Página vacía sin número, para cuadrar páginas. |

Cada página añadida se puede mover antes o después de su mensaje o quitar.

**Sugerencias (sin IA).** El aviso ámbar «Sugerencias: N para ocultar y N para destacar» abre un panel con dos pestañas:

| Grupo | Qué propone | ● |
| --- | --- | --- |
| Solo emojis | Mensajes como «👍» o «❤️» sin texto ni foto | Sí |
| Stickers | Imágenes .webp sin texto | Sí |
| Solo risas | «jajaja», «jsjs», «xd» | No |
| Respuestas de una palabra | «ok», «vale», «sí», «dale», «ya» | No |
| El primer mensaje | Destacarlo | Sí |
| Aniversarios | El primer mensaje de cada año en la fecha en que empezó el chat | Sí |
| Fechas especiales | 1 de enero, 14 de febrero, 24 y 25 de diciembre | No |
| Los más largos | Hasta 5 de más de 280 caracteres | No |

Cada grupo se abre para quitar mensajes sueltos. El botón dice lo que hará («Ocultar 94 y destacar 3 mensajes»). Los avisos de WhatsApp («Multimedia omitido», «Se eliminó este mensaje») ya los quita el importador.

### Paso 3 · Opciones del libro

Los valores sugeridos dependen de lo que subas. Los cambios se guardan solos y la vista previa se actualiza.

| Sección | Qué decide | Valor sugerido |
| --- | --- | --- |
| Tamaño de página | A5, 6 × 9 in o cuadrado de 21 cm; sangrado de 3 mm para imprenta. | A5 con sangrado |
| Tipografía | Cormorant, Caslon, Lora o Fraunces; tamaño pequeño, normal o grande. | Cormorant, normal |
| Paleta | Tela verde y oro, Vino y rosa, Tinta azul o Lino natural. | Tela verde y oro |
| Portada | Tela y oro, Tipográfica, Formas o Lino y etiqueta; título, subtítulo y autor. | Formas para chats, Tela para textos; título «Conversaciones con …» y los años del chat |
| Contenido | Cómo se ven los mensajes (uno por página, burbujas de chat o seguidos); en burbujas, quién va a la derecha; capítulos; nombre, fecha y hora de cada mensaje; ornamentos, portadilla, índice y dedicatoria. | Un mensaje por página · nombre y fecha · ornamentos, portadilla e índice |
| Ortografía | Revisión sin IA (ver más abajo). | Sin revisar |
| Imágenes | Fotos del chat, fotos en las aperturas de capítulo (tuyas o de bancos) o solo texto. | Fotos del chat, si el .zip las trae |
| Ayuda de la IA | Organizar en capítulos, corregir ortografía, sugerir título, diseñar portada. | Todo apagado |
| Salida | PDF de imprenta, EPUB y PNG por página. | PDF y EPUB |

### Capítulos de los chats

| Regla | Cómo corta | Ejemplo de título |
| --- | --- | --- |
| Por mes | Un capítulo por mes. | «Marzo de 2024 · 3 mensajes · del 2 al 31 de marzo» |
| Por año | Un capítulo por año. | «2023 · 120 mensajes · de marzo a diciembre» |
| Por silencios | Un capítulo nuevo tras N días sin mensajes (14 ● por defecto; tú eliges el número). | «Del 2 al 5 de marzo de 2023 · 1 mensaje · tras 25 días de silencio» |
| Sin capítulos | Todo seguido. | — |

- **Sugerencia:** por mes; si el chat dura más de dos años, por año.
- **Textos y documentos:** se cortan por sus títulos de nivel 1. Si no tienen, la IA puede proponer cortes, si la activas.

### Ortografía sin IA

Usa un diccionario de español que está en tu servidor; no envía el texto a ningún sitio.

1. **Revisar el texto** busca palabras dudosas, de la más repetida a la menos. Hay tres tipos:
   - **Falta una tilde o ñ** (canción, día, años). Vienen marcadas ● porque casi siempre aciertan.
   - **Abreviatura de chat** (q, xq, tb, porfa…), con su forma completa.
   - **Palabra desconocida**, con hasta 4 sugerencias.
2. **Qué no marca:** nombres de los participantes, palabras con mayúscula en medio de la frase (nombres propios), risas (jajaja, jeje), números ni palabras de menos de 3 letras.
3. **Elegir:** cada fila tiene su casilla y, si hay varias sugerencias, un selector. Al pasar el ratón se ve un fragmento del texto. Atajos: «Solo las tildes», «Todas», «Ninguna».
4. **Aplicar:** «Aplicar N correcciones» cambia las palabras marcadas en todo el libro. Respeta mayúsculas y cambia solo palabras completas.
5. **Deshacer:** las correcciones aplicadas se listan y cada una se deshace con ×.

Las tildes que dependen del sentido de la frase (esta/está, si/sí, tu/tú) no se detectan, porque las dos formas existen.

### Vista previa del libro

- **Doble página por defecto**, como se ve impreso: la portada sola a la derecha y luego pliegos enfrentados.
- **Página o Doble página** cambia la vista.
- **‹ ›** pasa de página o de pliego, con el número a la vista (por ejemplo, «4–5 / 37»).
- **Zoom:** − y + amplían o reducen; «Ajustar» encaja la página o el pliego entero en la ventana.
- **Tira de miniaturas** al pie: un clic lleva a esa página y la página actual queda resaltada.
- **La vista elegida se mantiene** al cambiar opciones.
- **Todo el libro, 40 páginas a la vez:** la vista previa tiene el libro entero y muestra una ventana de 40 páginas que se mueve sola al pasar de página, al elegir un mensaje o al usar las miniaturas. El número de página es siempre el real («306–307 / 648»).
- **Al editar no se recarga:** cuando cambias algo en el paso Contenido, solo se vuelve a maquetar el capítulo afectado; los números de página, las cabeceras y el índice se actualizan y la vista se queda donde estabas (o va a la página que acabas de añadir). Los cambios de opciones del libro (letra, tamaño, paleta…) sí recargan la vista previa entera.
- **Clic en un mensaje** abre su ficha en el paso Contenido.

### Generar libro

- El pie dice qué va a salir (por ejemplo, «PDF · EPUB · 37 págs. · A5») o qué falta («Añade una fuente para empezar»).
- Se generan los formatos marcados uno tras otro, con un mensaje de progreso, y se descargan:
  - PDF de imprenta con sangrado;
  - EPUB 3;
  - ZIP de PNG por página.

## 6. Galería

- **Imágenes:** las que descargas con «Guardar en galería» quedan guardadas con todo su diseño. Desde la galería se vuelven a descargar o se reabren en el estudio para seguir editándolas.
- **Libros:** también aparecen los libros guardados, para reabrirlos.

## 7. Ajustes

- **Keys de IA:** pegas una key y el proveedor se detecta solo:

  | La key empieza por | Proveedor |
  | --- | --- |
  | `sk-ant-` | Anthropic |
  | `sk-` | OpenAI |
  | `AIza` | Gemini |
  | `sk-or-` | OpenRouter |
  | `gsk_` | Groq |
  | `xai-` | xAI |
  | otra | Servicio compatible con OpenAI, con su URL base (DeepSeek, Mistral, Ollama, LM Studio…) |

- **Keys de fotos:** Unsplash y Pexels.
- **Marca personal:** firma (usuario), logo, colores y fuente.
- **Variables de entorno:** las keys también pueden venir del servidor.

## 8. Qué necesita una key y qué no

| Función | Sin keys | Con key de IA | Con key de fotos |
| --- | --- | --- | --- |
| Imágenes, propuestas, aleatorio, plantillas, patrones, lote | Sí | — | — |
| Texto de publicación y hashtags | Sí, con plantillas | También escritos por la IA | — |
| Fondo con foto | Sí, con tus fotos | — | También fotos de Unsplash y Pexels |
| Fondo generado | — | Sí (OpenAI) | — |
| Sugerencia de estilo por el tono del texto | — | Sí | — |
| Libros: importar, maquetar, capítulos, visor, PDF, EPUB y PNG | Sí | — | — |
| Ortografía | Sí, con diccionario | También corrección con IA | — |
| Capítulos con títulos, título y portada sugeridos | — | Sí | — |
| Fotos en los capítulos | Sí, con tus fotos | — | También de bancos |

## 9. Datos y privacidad

- **Dónde se guarda:** todo vive en una carpeta del servidor (`DATA_DIR`): ajustes, plantillas, galería, libros y tus fotos. No hay base de datos ni cuentas.
- **Qué sale del servidor:** el texto solo se envía al proveedor de IA cuando pulsas o marcas una ayuda de IA. Las búsquedas de fotos van a Unsplash o Pexels solo si las usas.
- **Ortografía y patrones:** funcionan sin conexión.
- **Créditos:** las fotos de bancos conservan su crédito en la imagen y en el libro.

## 10. Limitaciones conocidas

- En el EPUB los diseños especiales se simplifican (la cita va como cita en su página y las fotos completas como fotos con su texto) y la letra elegida por tramo no viaja: se usa la del libro.
- Si quitas una fuente y la vuelves a subir, lo decidido sobre sus mensajes no se recupera.
- En el lote no hay fondos de foto ni fondo IA.
- La ortografía sin IA no corrige tildes que dependen del sentido de la frase.
- Aún no se ha desplegado en Dokploy ni se ha probado con keys reales.

## 11. Versiones

| Versión | Qué añadió |
| --- | --- |
| v1 | Estudio de imágenes (propuestas, ajuste fino, carrusel, lote, galería, marca, fotos reales) y estudio de libros (importadores, un mensaje por página, PDF, EPUB y PNG). Docker. |
| v2 | Burbujas de chat en los libros y cuatro plantillas de imagen nuevas: Titular, Franja, Marco y Cuaderno. |
| v3 | Patrones generativos, botón Aleatorio con Anterior, 4 al azar y Mis plantillas. |
| v4 | Estudio en dos columnas con la vista previa fija, opciones plegables con resumen, visor del libro a doble página con zoom y navegación, e iconos de línea. |
| v6 | Paso Contenido en Libros: lista con filtros y selección múltiple, ficha de cada mensaje (ocultar, destacar, capítulo aquí, diseños Cita / Foto completa / Foto + texto, fotos una a una, texto con formato), páginas añadidas (separador, página libre, imagen, en blanco), sugerencias sin IA clic en la vista previa y panel de atajos (?). |
| v7 | Ficha y sugerencias en una hoja desde abajo en el móvil, y vista previa que se actualiza por capítulos al editar, sin recargar ni parpadear. |
| v5 | Texto de publicación y hashtags sin IA, capítulos por año o por silencios, fotos propias, ortografía sin IA, atajos R y Ctrl+Z, vista previa fija en móvil, miniaturas del libro, lote ajustable e imagen Docker de 1,3 GB. |
