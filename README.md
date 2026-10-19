# Appear Writer

Convierte tus palabras en diseño. Este proyecto es una web app personal con dos funciones:

- **Imágenes para redes:** escribe una frase y obtén imágenes llamativas y en alta resolución para Instagram y Facebook, en formato post (4:5), cuadrado (1:1), historia (9:16) o carrusel.
- **Libros:** sube un chat de WhatsApp, un archivo .txt, .docx o .pdf, o pega un texto, y obtén un libro maquetado en PDF para imprimir, en EPUB y en imágenes por página.

## Cómo funciona

1. Introduces el texto o subes los archivos.
2. El sistema propone una configuración base: formato, tipografía, paleta, fondo, marca personal y extras.
3. Revisas todas las opciones en una lista de casillas y cambias las que quieras.
4. Eliges entre varias propuestas, haces los ajustes finales y descargas el resultado.

La IA es opcional. Cada ayuda (sugerencia de estilo, capítulos, ortografía, título y portada, texto de la publicación y hashtags) tiene su propia casilla y nunca cambia tu contenido sin permiso.

## Estado

🎨 Fase de diseño. Estamos definiendo la propuesta visual antes de empezar a programar.

## Tecnología prevista

Next.js, TypeScript y Tailwind · Playwright para generar PNG y PDF · Claude API · SQLite · despliegue con Docker en Dokploy.

## Hoja de ruta

- [ ] Galería de propuestas visuales
- [ ] Base de la app y motor de diseño
- [ ] Imágenes v1
- [ ] Libros v1 (WhatsApp con un mensaje por página, PDF, EPUB y PNG)
- [ ] Extras: marca personal, generación en lote, galería, fotos reales
- [ ] v2: chat con burbujas y más plantillas
