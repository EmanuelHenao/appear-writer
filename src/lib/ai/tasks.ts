import "server-only";
import { z } from "zod";
import { IMAGE_FONT_CHOICES } from "@/design/fonts";
import { PALETTES } from "@/design/palettes";
import { generateJson } from "./client";
import type { ResolvedAiConfig } from "./detect";

// Cada tarea es opcional y la activa una casilla. Ninguna reescribe el
// texto del usuario: solo propone valores que el usuario ve y puede cambiar.

const FamilyEnum = z.enum(["bold", "vivo", "minimal", "arte"]);
const PaletteEnum = z.enum(PALETTES.map((p) => p.id) as [string, ...string[]]);
const FontEnum = z.enum(IMAGE_FONT_CHOICES as [string, ...string[]]);

export const BriefSchema = z.object({
  tono: z.string().describe("Tono del texto en 2 a 4 palabras, en español"),
  familias: z.array(FamilyEnum).describe("Familias de estilo ordenadas de más a menos adecuada; al menos 2"),
  paleta: PaletteEnum,
  fuente: FontEnum,
  destacar: z.array(z.string()).describe("Palabras o frase corta copiadas literalmente del texto para resaltar; vacío si no hace falta"),
  fotoClave: z.string().describe("2 a 4 palabras en inglés para buscar una foto real de fondo"),
  razon: z.string().describe("Una frase en español que explica la propuesta"),
});
export type Brief = z.infer<typeof BriefSchema>;

export async function designBrief(cfg: ResolvedAiConfig, text: string): Promise<Brief> {
  const palettes = PALETTES.map((p) => `${p.id} (${p.label}: fondo ${p.bg}, texto ${p.fg}, acento ${p.accent})`).join("; ");
  const brief = await generateJson(cfg, {
    schema: BriefSchema,
    tier: "main",
    maxTokens: 4000,
    system:
      "Eres director de arte de publicaciones para Instagram y Facebook. Lees el tono de una frase y propones un estilo visual que llame la atención en el feed sin perder legibilidad. No reescribes ni corriges el texto.",
    prompt: `Texto de la publicación:\n"""${text}"""\n\nFamilias disponibles: bold (letra enorme y contraste, para frases motivacionales o contundentes), vivo (bloques y degradados de color intenso, para energía y alegría), minimal (mucho aire y serif fina, para frases reflexivas o delicadas), arte (collage, papel y acuarela, para frases emotivas o creativas).\nPaletas: ${palettes}.\nFuentes: ${IMAGE_FONT_CHOICES.join(", ")}.\nLas palabras de «destacar» deben aparecer tal cual en el texto.`,
  });
  // Solo se aceptan destacados que existan de verdad en el texto.
  const lower = text.toLocaleLowerCase("es");
  brief.destacar = brief.destacar.filter((d) => d.trim() && lower.includes(d.toLocaleLowerCase("es"))).slice(0, 3);
  if (brief.familias.length === 0) brief.familias = ["bold", "minimal"];
  return brief;
}

export const CaptionSchema = z.object({
  texto: z.string().describe("Texto de la publicación en español, 1 a 3 frases, sin hashtags"),
  hashtags: z.array(z.string()).describe("Entre 8 y 15 hashtags relevantes, sin espacios, empezando por #"),
});

export async function writeCaption(cfg: ResolvedAiConfig, text: string) {
  const out = await generateJson(cfg, {
    schema: CaptionSchema,
    tier: "fast",
    maxTokens: 2000,
    system:
      "Escribes textos breves para acompañar publicaciones de Instagram y Facebook. Tono cercano, sin exagerar, sin emojis en exceso (máximo dos). Escribe en el mismo idioma del texto.",
    prompt: `La imagen dice:\n"""${text}"""\n\nEscribe el texto que acompaña la publicación y los hashtags.`,
  });
  out.hashtags = out.hashtags
    .map((h) => "#" + h.replace(/^#+/, "").replace(/\s+/g, ""))
    .filter((h) => h.length > 1)
    .slice(0, 15);
  return out;
}

// ——— Libros ———

export const TitleSchema = z.object({
  titulo: z.string().describe("Título del libro, breve y evocador"),
  subtitulo: z.string().describe("Subtítulo de una línea"),
});

export async function suggestBookTitle(cfg: ResolvedAiConfig, summary: string) {
  return generateJson(cfg, {
    schema: TitleSchema,
    tier: "main",
    maxTokens: 2000,
    system: "Propones títulos para libros personales hechos con textos reales del autor. Títulos breves, cálidos y sin clichés. Escribe en el idioma del contenido.",
    prompt: `Contenido del libro (resumen y muestras):\n${summary}`,
  });
}

export const CoverSchema = z.object({
  portada: z.enum(["tela", "tipografica", "formas", "lino"]),
  paleta: z.enum(["verde-oro", "vino-rosa", "tinta-azul", "lino-natural"]),
  razon: z.string(),
});

export async function suggestCover(cfg: ResolvedAiConfig, summary: string) {
  return generateJson(cfg, {
    schema: CoverSchema,
    tier: "fast",
    maxTokens: 1500,
    system: "Eres diseñador editorial. Eliges la portada y la paleta que mejor encajan con el contenido de un libro personal.",
    prompt: `Portadas: tela (tela con marco dorado, clásica), tipografica (título enorme, moderna), formas (dos círculos que se cruzan, para dos personas o dos voces), lino (lino claro con etiqueta, tipo álbum).\nPaletas: verde-oro, vino-rosa, tinta-azul, lino-natural.\n\nContenido:\n${summary}`,
  });
}

export const ChapterTitlesSchema = z.object({
  titulos: z.array(z.string()).describe("Un título por capítulo, en el mismo orden"),
});

export async function titleChapters(cfg: ResolvedAiConfig, excerpts: string[]) {
  const out = await generateJson(cfg, {
    schema: ChapterTitlesSchema,
    tier: "fast",
    maxTokens: 4000,
    system: "Pones títulos breves (2 a 6 palabras) a capítulos de un libro personal a partir de un fragmento de cada uno. No inventas hechos. Escribe en el idioma del contenido.",
    prompt: excerpts.map((e, i) => `Capítulo ${i + 1}:\n${e}`).join("\n\n"),
  });
  return out.titulos;
}

export const BreaksSchema = z.object({
  capitulos: z.array(z.object({ inicio: z.number().int(), titulo: z.string() })),
});

/** Propone dónde empieza cada capítulo en un texto sin títulos. */
export async function splitIntoChapters(cfg: ResolvedAiConfig, paragraphs: string[]) {
  const listing = paragraphs.map((p, i) => `[${i}] ${p.slice(0, 160).replace(/\s+/g, " ")}`).join("\n");
  const out = await generateJson(cfg, {
    schema: BreaksSchema,
    tier: "main",
    maxTokens: 6000,
    system: "Organizas textos en capítulos. Indicas el índice del párrafo donde empieza cada capítulo (el primero empieza en 0) y un título breve. Entre 2 y 12 capítulos. No inventas contenido.",
    prompt: `Párrafos numerados:\n${listing}`,
  });
  const seen = new Set<number>();
  return out.capitulos
    .filter((c) => c.inicio >= 0 && c.inicio < paragraphs.length && !seen.has(c.inicio) && seen.add(c.inicio))
    .sort((a, b) => a.inicio - b.inicio);
}

export const SpellingSchema = z.object({
  textos: z.array(z.string()).describe("Los textos corregidos, mismo número y orden"),
});

/** Corrige ortografía y puntuación sin cambiar estilo ni voz. */
export async function correctSpelling(cfg: ResolvedAiConfig, texts: string[]): Promise<string[]> {
  const out = await generateJson(cfg, {
    schema: SpellingSchema,
    tier: "fast",
    maxTokens: 16000,
    system:
      "Corriges solo ortografía, tildes y puntuación evidente. No cambias palabras, estilo, voz, groserías ni expresiones coloquiales. Si un texto está bien, lo devuelves igual. Devuelves exactamente el mismo número de textos.",
    prompt: JSON.stringify(texts),
  });
  // Si el número no coincide no se aplica nada: el original manda.
  return out.textos.length === texts.length ? out.textos : texts;
}
