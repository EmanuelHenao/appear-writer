# CLAUDE.md

Guía para trabajar en este repositorio con Claude Code.

## Qué es

**Appear Writer** es una web app de uso personal con dos funciones:

1. **Imágenes para redes:** convierte un texto o frase en una imagen llamativa y de alta resolución para Instagram y Facebook.
2. **Libros:** convierte chats de WhatsApp, archivos .txt, .docx, .pdf o texto pegado en un libro maquetado (PDF de imprenta, EPUB e imágenes por página).

Estado actual: fase de diseño. Todavía no hay código. El plan aprobado está en `/home/ema/.claude/plans/giggly-foraging-wall.md` y la galería de propuestas visuales en https://claude.ai/artifact/TDMx83DGEfQtrH7oQFT4DA.

## Principios de producto (no negociables)

- **El usuario decide todo.** Antes de crear una imagen o un libro, todas las opciones aparecen en un panel de casillas y selectores, precargadas con valores base que sugiere el sistema. El usuario puede cambiar cualquiera. Nunca se aplica una decisión que el usuario no haya visto.
  - Imágenes: formato, tipografía, colores, paleta, fondo, marca personal y extras.
  - Libros: fuentes, tamaño de página, tipografía, paleta, portada, ornamentos, imágenes, pasos de IA y formatos de salida.
- **IA mínima y opcional.** Cada llamada a la IA se activa con su propia casilla. Nunca se reescribe el contenido del usuario sin permiso. Los valores base salen primero de reglas deterministas (por ejemplo, la longitud del texto sugiere el formato).
- **El texto se renderiza nítido.** La IA nunca dibuja el texto dentro de la imagen.
- **Las fotos de personas deben parecer reales.** Se usan bancos de fotos (Unsplash y Pexels) en lugar de imágenes generadas.
- **El diseño es la prioridad.** Ante decisiones visuales, propón opciones y pregunta antes de decidir.

## Decisiones de diseño (galería aprobada)

- **Estilos de imagen:** bold editorial, color vivo (bloques planos y degradados con grano), minimalista y artístico (collage, acuarela). **Nada de neón, brillos ni efecto vidrio:** el usuario los descartó.
- **4 propuestas** por texto.
- **Portadas de libro:** A (tela verde con marco dorado), C (tipográfica, título enorme), D (círculos superpuestos sobre azul tinta) y E (lino con etiqueta). La portada con foto se descartó.
- **Interior del libro:** Cormorant es la letra sugerida, pero el usuario elige entre Cormorant, Caslon, Lora y Fraunces. Nombre, fecha y hora de cada mensaje son casillas separadas (por defecto: nombre y fecha).

## Arquitectura prevista

- Next.js (App Router), TypeScript y Tailwind, en un solo servicio.
- `src/options/`: esquemas zod con todas las opciones y sus valores base. Desde ellos se generan el panel de la UI y la validación del servidor.
- `src/design/`: motor de diseño compartido (paletas, parejas de fuentes, texturas y ornamentos). `fit.ts` decide formato, tamaño de letra y división en carrusel según la longitud del texto, sin IA.
- `src/import/`: importadores de WhatsApp (.txt o .zip, formatos de Android e iOS, fechas en español), .docx (mammoth), .pdf, .txt y texto pegado. Todos producen un modelo común `Bloque[]`.
- Renderizado con Playwright/Chromium: PNG a 2x (por ejemplo, 2160×2700) y PDF con Paged.js. El EPUB se genera con JSZip.
- IA: Claude API con salida estructurada. `claude-sonnet-5-5` para el brief de diseño y `claude-haiku-5-5` para el texto de la publicación y los hashtags.
- Persistencia: SQLite con Drizzle, y archivos en `/data`.
- Acceso protegido por una contraseña única en una variable de entorno.
- Despliegue: Docker sobre la imagen de Playwright, en Dokploy.

## Alcance de la v1

- Imágenes: formatos 4:5, 1:1, 9:16 y carrusel; 4 variaciones por texto con ajuste fino; marca personal opcional; texto de la publicación, hashtags, generación en lote y galería.
- Libros: WhatsApp maquetado tal cual, **un mensaje por página**. El chat con burbujas queda para la v2.

## Convenciones

- La UI, los textos y la documentación van en español.
- La UI de la app sigue el estilo "estudio oscuro creativo": fondo oscuro para que los diseños generados destaquen.
- Los importadores y `fit.ts` se prueban con Vitest. Los flujos de punta a punta (dimensiones del PNG, páginas del PDF, validez del EPUB) se prueban con Playwright.
