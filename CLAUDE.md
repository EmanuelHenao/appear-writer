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
  - `templates/`: las 12 plantillas como componentes React con estilos en línea; `autofit.ts` ajusta la letra.
  - `compose.ts`: esquema de opciones (zod), valores sugeridos, propuestas y diapositivas.
- `src/lib/render/`: Chromium compartido (Playwright). Los documentos se sirven desde un origen virtual (`http://appear.local/`) con fuentes y archivos locales. `image.ts` renderiza las mismas plantillas con `react-dom/server`.
- `src/lib/ai/`: `detect.ts` detecta el proveedor por la key; `client.ts` usa el SDK oficial de Anthropic (salida estructurada) y HTTP directo para OpenAI/compatibles y Gemini; `tasks.ts` contiene los prompts.
- `src/import/`: importadores (WhatsApp, texto, docx con mammoth, pdf con unpdf) hacia el modelo `Block` de `src/book/model.ts`.
- `src/book/`: opciones y paletas del libro, `structure.ts` (capítulos deterministas), `covers.ts`, `html.ts` + `paginate.js.ts` (documento único para vista previa, PDF y PNG; el paginador corre en el navegador), `epub.ts`, `service.ts`.
- Persistencia en archivos bajo `DATA_DIR` (por defecto `./data`): `settings.json`, `gallery/<id>/`, `books/<id>/book.json` + `media/`. No hay base de datos.
- Acceso con contraseña única (`APP_PASSWORD`, Basic Auth en `src/proxy.ts`).

## Convenciones

- La UI, los textos, los comentarios y la documentación van en español.
- Cada opción nueva entra en el esquema zod correspondiente con su valor sugerido y aparece en el panel; si usa IA, lleva su casilla, apagada por defecto.
- Las plantillas y portadas nuevas se prueban renderizándolas (`test/render-*.test.ts`) y mirando el resultado.
- La versión de `playwright` en `package.json` debe coincidir con la imagen base del `Dockerfile`.
