# Appear Writer

Convierte tus palabras en diseño. Este proyecto es una web app personal con dos funciones:

- **Imágenes para redes:** escribe una frase y obtén imágenes llamativas y en alta resolución para Instagram y Facebook, en formato post (4:5), cuadrado (1:1), historia (9:16) o carrusel.
- **Libros:** sube un chat de WhatsApp, un archivo .txt, .docx o .pdf, o pega un texto, y obtén un libro maquetado en PDF para imprimir, en EPUB y en imágenes por página.

Funciona entera sin IA y sin ninguna key. El detalle de cada función y de cómo se comporta está en [docs/PRODUCTO.md](docs/PRODUCTO.md).

## Cómo funciona

1. Introduces el texto o subes los archivos en la columna izquierda.
2. El sistema propone una configuración base: formato, tipografía, paleta, fondo, marca personal y extras. Los valores sugeridos llevan un punto ámbar (●).
3. Revisas las opciones, agrupadas en secciones plegables que muestran lo elegido, y cambias las que quieras.
4. A la derecha, la vista previa siempre visible: eliges entre cuatro propuestas (o ves el libro a doble página), haces los ajustes finales y descargas el resultado.

La IA es opcional. Cada ayuda (sugerencia de estilo, capítulos, ortografía, título y portada, texto de la publicación) tiene su propia casilla o botón, viene apagada y nunca cambia tu contenido sin permiso: el texto original se conserva y basta desmarcar la casilla para quitar lo que hizo la IA. Casi todas tienen además una versión sin IA (plantillas, diccionario, reglas).

## Funciones

**Imágenes**
- Dieciséis diseños en cuatro estilos: bold editorial, color vivo, minimalista y artístico.
- El formato se sugiere según la longitud del texto, y los textos largos se reparten en un carrusel de hasta 10 imágenes.
- La letra se ajusta sola al espacio; en las historias deja libres las zonas que tapa la interfaz de Instagram.
- PNG a 2160 px de ancho, carrusel en ZIP, generación en lote y galería para reabrir y volver a descargar.
- Marca personal opcional: firma, logo, paleta y fuente.
- Fondos con fotos reales de Unsplash o Pexels, con su crédito, o generados con IA (requiere una key de OpenAI).
- Patrones generativos sin IA ni keys (v3): 19 tipos entre geométricos (Truchet, Bauhaus, semitono…), funciones matemáticas (campo de flujo, Lissajous, espirógrafo, curvas de nivel, Voronoi, árbol fractal…), emojis y ASCII. Marcas en una lista cuáles se usan; cada imagen lleva uno al azar o varios superpuestos. Se ajustan intensidad, tamaño y variación.
- Botón «Aleatorio» para probar un diseño al azar con lo marcado en el panel (con «Anterior» para volver) y «4 al azar».
- Vista previa grande y siempre visible, con las cuatro propuestas al lado; en el móvil queda fija arriba.
- «Mis plantillas»: guarda las propuestas que te gusten y reutilízalas con otros textos.
- Texto de la publicación y hashtags sin IA (v5): plantillas con tres estilos y hashtags sacados de las palabras del texto; se editan y se copian. La IA queda como botón opcional.
- Fondos con tus propias fotos, sin ninguna key (v5).
- Lote: elige cualquier imagen para ajustarla antes de descargar el ZIP (v5).
- Atajos: ← → cambian de propuesta, R da una al azar y Ctrl+Z vuelve a la anterior.

**Libros**
- Chats de WhatsApp de Android e iOS, en español o inglés, con las fotos del .zip.
- Un mensaje por página, burbujas de chat (v2) o mensajes seguidos. El nombre, la fecha y la hora de cada mensaje se activan por separado.
- Capítulos de los chats por mes, por año o por silencios (cuando pasan varios días sin mensajes), y por títulos en los textos.
- Revisión ortográfica sin IA con un diccionario de español: propone tildes, abreviaturas y palabras dudosas, y solo cambia las que marques.
- Tus propias fotos en las aperturas de capítulo.
- Visor a doble página con miniaturas, zoom y navegación.
- Cuatro portadas, cuatro tipografías y cuatro paletas; portadilla, dedicatoria, índice con números de página, cabeceras y ornamentos.
- PDF con sangrado para imprenta (A5, 6 × 9 in o cuadrado de 21 cm), EPUB 3 validado con epubcheck y PNG por página.

## Puesta en marcha

Requisitos: Node 22 o superior, pnpm y el Chromium de Playwright.

```bash
pnpm install
pnpm exec playwright install chromium   # si no lo tienes
cp .env.example .env.local              # opcional
pnpm dev                                # http://localhost:3000
```

Las keys de IA y de fotos se pueden poner en la página **Ajustes** o como variables de entorno (ver `.env.example`). Sirve cualquier proveedor:

| Key | Proveedor detectado |
| --- | --- |
| `sk-ant-…` | Anthropic (Claude) |
| `sk-…` | OpenAI |
| `AIza…` | Google Gemini |
| `sk-or-…` | OpenRouter |
| `gsk_…` | Groq |
| `xai-…` | xAI |
| otra | Compatible con OpenAI: indica la URL base (DeepSeek, Mistral, Ollama, LM Studio…) |

## Despliegue (Dokploy o cualquier servidor)

```bash
docker compose up -d --build
```

- Define `APP_PASSWORD` para proteger el acceso.
- Los datos (galería, libros, plantillas, fotos subidas y ajustes) se guardan en el volumen `/data`.
- La imagen pesa unos 1,3 GB: Node, el Chromium mínimo de Playwright y solo los archivos que la app usa.
- En Dokploy, crea una aplicación de tipo Compose apuntando a este repositorio.

## Desarrollo

```bash
pnpm test        # pruebas (incluye render real con Chromium)
pnpm typecheck
pnpm lint
```

Para validar también el EPUB con epubcheck, indica la ruta del jar: `EPUBCHECK_JAR=/ruta/epubcheck.jar pnpm test`.

## Hoja de ruta

- [x] Galería de propuestas visuales
- [x] Base de la app y motor de diseño
- [x] Imágenes v1
- [x] Libros v1 (WhatsApp con un mensaje por página, PDF, EPUB y PNG)
- [x] Extras: marca personal, generación en lote, galería, fotos reales
- [x] v2: chat con burbujas y cuatro plantillas nuevas (Titular, Franja, Marco, Cuaderno)
- [x] v3: patrones generativos, diseño aleatorio y plantillas propias
- [x] v4: estudio en dos columnas con la vista previa siempre visible, opciones plegables y visor de libro a doble página
- [x] v5: mejoras sin IA (texto y hashtags, ortografía, capítulos por año o silencios, fotos propias), lote ajustable e imagen Docker de 1,3 GB
