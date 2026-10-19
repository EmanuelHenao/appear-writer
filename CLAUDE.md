# CLAUDE.md

Guía para trabajar en este repositorio con Claude Code.

@AGENTS.md

## Qué es

**Appear Writer** es una web app de uso personal con dos funciones:

1. **Imágenes para redes:** convierte un texto o frase en una imagen llamativa y de alta resolución para Instagram y Facebook.
2. **Libros:** convierte chats de WhatsApp, archivos .txt, .docx, .pdf o texto pegado en un libro maquetado (PDF de imprenta, EPUB e imágenes por página).

La galería de propuestas visuales aprobada está en https://claude.ai/artifact/TDMx83DGEfQtrH7oQFT4DA.

## Principios de producto (no negociables)

- **El usuario decide todo.** Antes de crear una imagen o un libro, todas las opciones aparecen en un panel de casillas y selectores, precargadas con valores base que sugiere el sistema (marcados con ●). El usuario puede cambiar cualquiera. Nunca se aplica una decisión que el usuario no haya visto.
- **IA mínima y opcional.** Cada llamada a la IA se activa con su propia casilla y viene apagada. Nunca se reescribe el contenido del usuario: los resultados de la IA se guardan aparte (`book.ai`) y solo se aplican mientras su casilla esté marcada. Los valores base salen primero de reglas deterministas.
- **El texto se renderiza nítido.** La IA nunca dibuja el texto dentro de la imagen.
- **Las fotos de personas deben parecer reales.** Se usan bancos de fotos (Unsplash y Pexels), con su crédito.
- **Debe funcionar con cualquier API key** (Anthropic, OpenAI, Gemini, OpenRouter, Groq, xAI, DeepSeek, Mistral o cualquier servicio compatible con OpenAI) y también sin ninguna.
- **El diseño es la prioridad.** Ante decisiones visuales, propón opciones y pregunta antes de decidir.

## Decisiones de diseño (galería aprobada)

- **Estilos de imagen:** bold editorial, color vivo (bloques planos y degradados con grano), minimalista y artístico (collage, acuarela). **Nada de neón, brillos ni efecto vidrio:** el usuario los descartó.
- **4 propuestas** por texto.
- **Portadas de libro:** A (tela verde con marco dorado), C (tipográfica, título enorme), D (círculos superpuestos sobre azul tinta) y E (lino con etiqueta). La portada con foto se descartó.
- **Interior del libro:** Cormorant es la letra sugerida, pero el usuario elige entre Cormorant, Caslon, Lora y Fraunces. Nombre, fecha y hora de cada mensaje son casillas separadas (por defecto: nombre y fecha).
- **Interfaz:** "estudio oscuro creativo"; acento lila `#b6a6ff`, ámbar `#ffc56b` para lo sugerido. Tokens en `src/app/globals.css`.
- **Layout de los estudios (v4):** dos columnas (`src/components/StudioLayout.tsx`). A la izquierda, los pasos con scroll propio y la acción principal fija al pie; a la derecha, la vista previa, que nunca se mueve. Las secciones de opciones son plegables y muestran lo elegido en su título (`Section` con `summary`). En Imágenes el ajuste fino es el paso 3 de la columna izquierda; en Libros la vista previa es a doble página por defecto. Iconos de línea en `src/components/icons.tsx`, sin emojis en la interfaz.
- **Paso Contenido de Libros (v6, maqueta aprobada en https://claude.ai/artifact/AwYbA28RQF56nuK58SKpx6):** la lista y la ficha del mensaje se sustituyen en la columna izquierda (la vista previa nunca se tapa). Destacar (D) aplica Cita directamente. El separador es solo decorativo; los capítulos se crean con «Capítulo aquí».

## Comandos

```bash
pnpm dev            # servidor de desarrollo
pnpm test           # Vitest: unidad + integración con Chromium real
pnpm typecheck      # next typegen + tsc
pnpm lint
pnpm build
docker compose up -d --build
```

`EPUBCHECK_JAR=/ruta/epubcheck.jar pnpm test` valida además el EPUB. `RENDER_OUT=/carpeta` guarda los PNG y PDF de las pruebas para revisarlos.

## Arquitectura

- **Next.js 16** (App Router) + TypeScript + Tailwind 4. Ojo: el middleware se llama `src/proxy.ts` en esta versión; lee `node_modules/next/dist/docs/` antes de usar APIs de Next.
- `src/design/`: motor de imágenes compartido entre cliente y servidor.
  - `fit.ts`: lectura determinista del texto (longitud, formato sugerido, carrusel, destacado).
  - `fonts.ts` y `palettes.ts`: registros (fuentes de @fontsource, paletas con roles fijos).
  - `templates/`: las 16 plantillas como componentes React con estilos en línea; `autofit.ts` ajusta la letra.
  - `patterns.tsx`: fondos generativos deterministas (semilla → mismo dibujo en vista previa, PNG y plantilla guardada). Cada tipo nuevo va en `PATTERNS` y `PAINTERS`.
  - `compose.ts`: esquema de opciones (zod), valores sugeridos, propuestas, diseño aleatorio (`randomDesign`) y diapositivas.
  - `saved.ts`: esquema de «Mis plantillas» (`DATA_DIR/templates.json`, vía `/api/templates`).
  - `caption.ts`: texto de publicación y hashtags sin IA (plantillas por estilo y palabras clave del texto). Lo usa el estudio y `/api/render/batch` (un `.txt` por imagen).
- `src/components/`: `StudioLayout.tsx` (dos columnas; `stickyPreview` fija la vista previa arriba en móvil), `ui.tsx` (`Section` plegable con `summary`), `icons.tsx`, `OwnPhotos.tsx` (subir y elegir fotos propias).
- `src/lib/render/`: Chromium compartido (Playwright). Los documentos se sirven desde un origen virtual (`http://appear.local/`) con fuentes y archivos locales. `image.ts` renderiza las mismas plantillas con `react-dom/server`.
- `src/lib/ai/`: `detect.ts` detecta el proveedor por la key; `client.ts` usa el SDK oficial de Anthropic (salida estructurada) y HTTP directo para OpenAI/compatibles y Gemini; `tasks.ts` contiene los prompts.
- `src/import/`: importadores (WhatsApp, texto, docx con mammoth, pdf con unpdf) hacia el modelo `Block` de `src/book/model.ts`.
- `src/book/`: opciones y paletas del libro, `structure.ts` (capítulos deterministas: por mes, año, silencios o ninguno, más las correcciones de `fixes.ts`), `covers.ts`, `html.ts` + `paginate.js.ts` (documento único para vista previa, PDF y PNG; el paginador corre en el navegador y, en la vista previa, atiende `postMessage` `book-control` para página/doble página, zoom y navegación, y responde con `book-view`), `epub.ts`, `service.ts`.
- Paso Contenido (v6): `src/book/edits.ts` (esquema zod de `book.edits`: por bloque `hidden`, `design`, `runs` con formato, `align`, `chapter`, `photos`; y `inserts`, las páginas añadidas), `rows.ts` (filas de la lista), `suggest.ts` (sugerencias deterministas para ocultar o destacar). `buildChapters(sources, options, ai, edits)` aplica todo al maquetar; el original nunca se toca. UI en `src/app/libros/ContentStep.tsx`, `MessageInspector.tsx`, `RichText.tsx` (editor que pinta y lee `Run[]`, nunca guarda HTML) y `SuggestPanel.tsx`. En la vista previa cada bloque lleva `data-key`; el paginador envía `book-pick` al hacer clic y `book-focus`, acepta `book-control {focus}` y `?foco=<clave>` centra la ventana de páginas. `place()` parte el texto por caracteres conservando los spans de formato (`setRange`). El documento llega en secciones (`bookSegments` en `html.ts`: `_inicio` y cada capítulo, con huella); la vista previa tiene todas las páginas y muestra una ventana de 40 (`.page.off`). Al guardar `edits`, el estudio pide `/api/books/[id]/preview?formato=secciones` y envía `book-control {patch}`: el paginador repagina solo las secciones con huella distinta y renumera (folios, cabeceras, «Capítulo N» con `data-roman`, índice). Nada que dependa de la posición del capítulo debe ir en su HTML. Las opciones del libro siguen recargando el iframe.
- `src/lib/spelling.ts`: ortografía sin IA con nspell y `dictionary-es` (leído de `node_modules`). Solo propone; lo aplicado se guarda en `book.options.fixes`.
- `src/lib/uploads.ts`: fotos propias en `DATA_DIR/uploads/propias` (`/api/uploads`).
- `docs/PRODUCTO.md`: funciones y comportamiento del producto. Actualízalo cuando cambie lo que ve el usuario.
- Persistencia en archivos bajo `DATA_DIR` (por defecto `./data`): `settings.json`, `templates.json`, `uploads/propias/` (tus fotos, vía `/api/uploads`), `gallery/<id>/`, `books/<id>/book.json` (fuentes, opciones y `edits`) + `media/`. No hay base de datos.
- Acceso con contraseña única (`APP_PASSWORD`, Basic Auth en `src/proxy.ts`).

## Convenciones

- La UI, los textos, los comentarios y la documentación van en español.
- Cada opción nueva entra en el esquema zod correspondiente con su valor sugerido y aparece en el panel; si usa IA, lleva su casilla, apagada por defecto.
- Las plantillas y portadas nuevas se prueban renderizándolas (`test/render-*.test.ts`) y mirando el resultado.
- La versión de `playwright` en `package.json` debe coincidir con `PLAYWRIGHT_VERSION` del `Dockerfile`. La imagen usa la salida `standalone` de Next: lo que se lea de `node_modules` en tiempo de ejecución (fuentes, Playwright) va en `outputFileTracingIncludes` de `next.config.ts`.
