// Lectura del texto sin IA: cuenta caracteres, clasifica la longitud y
// sugiere formato y división en diapositivas. Todo es determinista.

export type FormatId = "4:5" | "1:1" | "9:16" | "carrusel";
export type LengthClass = "corta" | "media" | "larga" | "muy-larga";

export const FORMAT_SIZES: Record<Exclude<FormatId, "carrusel">, { w: number; h: number; label: string }> = {
  "4:5": { w: 1080, h: 1350, label: "Post vertical" },
  "1:1": { w: 1080, h: 1080, label: "Cuadrado" },
  "9:16": { w: 1080, h: 1920, label: "Historia / Reel" },
};

/** Límites de longitud, en caracteres. */
export const LIMITS = {
  corta: 60,
  media: 220,
  larga: 500,
  /** Caracteres máximos por diapositiva de carrusel. */
  porDiapositiva: 180,
  /** Instagram admite hasta 20; más de 10 deja de leerse bien. */
  maxDiapositivas: 10,
};

export interface TextReading {
  text: string;
  chars: number;
  words: number;
  sentences: number;
  lengthClass: LengthClass;
  suggestedFormat: FormatId;
  slides: string[];
  emphasis: string[];
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

/** Divide en frases respetando ¿? ¡! y puntos suspensivos. */
export function splitSentences(text: string): string[] {
  const flat = text.replace(/\s*\n\s*/g, " ").trim();
  if (!flat) return [];
  const parts = flat.match(/[^.!?…]+(?:[.!?…]+["»”’)]*|$)/g) ?? [flat];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export function classifyLength(chars: number): LengthClass {
  if (chars <= LIMITS.corta) return "corta";
  if (chars <= LIMITS.media) return "media";
  if (chars <= LIMITS.larga) return "larga";
  return "muy-larga";
}

export function suggestFormat(chars: number): FormatId {
  const c = classifyLength(chars);
  if (c === "corta") return "4:5";
  if (c === "media") return chars > 140 ? "1:1" : "4:5";
  return "carrusel";
}

/** Corta una frase demasiado larga por comas y, si hace falta, por palabras. */
function splitLong(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence];
  const out: string[] = [];
  const byComma = sentence.split(/(?<=[,;:])\s+/);
  let cur = "";
  const pushWords = (chunk: string) => {
    for (const w of chunk.split(/\s+/)) {
      if ((cur + " " + w).trim().length > max && cur) {
        out.push(cur.trim());
        cur = w;
      } else cur = (cur + " " + w).trim();
    }
  };
  for (const piece of byComma) {
    if (piece.length > max) {
      pushWords(piece);
    } else if ((cur + " " + piece).trim().length > max && cur) {
      out.push(cur.trim());
      cur = piece;
    } else cur = (cur + " " + piece).trim();
  }
  if (cur) out.push(cur.trim());
  return out;
}

/**
 * Reparte el texto en diapositivas. Un párrafo en blanco fuerza un corte;
 * dentro de cada párrafo se agrupan frases hasta el máximo de caracteres.
 */
export function splitSlides(text: string, max = LIMITS.porDiapositiva): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  const slides: string[] = [];
  for (const para of norm.split(/\n\n+/)) {
    let cur = "";
    for (const s of splitSentences(para).flatMap((x) => splitLong(x, max))) {
      if ((cur + " " + s).trim().length > max && cur) {
        slides.push(cur.trim());
        cur = s;
      } else cur = (cur + " " + s).trim();
    }
    if (cur) slides.push(cur.trim());
  }
  if (slides.length <= LIMITS.maxDiapositivas) return slides;
  // Demasiadas: se reagrupan en el máximo permitido, repartiendo por igual.
  const per = Math.ceil(slides.length / LIMITS.maxDiapositivas);
  const merged: string[] = [];
  for (let i = 0; i < slides.length; i += per) merged.push(slides.slice(i, i + per).join(" "));
  return merged;
}

/** Destacado por defecto: la última frase si es corta (por ejemplo, «Créalo.»). */
export function defaultEmphasis(text: string): string[] {
  const sentences = splitSentences(text);
  if (sentences.length < 2) return [];
  const last = sentences[sentences.length - 1];
  return countWords(last) <= 4 ? [last] : [];
}

export function readText(text: string): TextReading {
  const norm = normalizeText(text);
  const chars = norm.replace(/\n/g, " ").length;
  const lengthClass = classifyLength(chars);
  const suggestedFormat = suggestFormat(chars);
  return {
    text: norm,
    chars,
    words: countWords(norm),
    sentences: splitSentences(norm).length,
    lengthClass,
    suggestedFormat,
    slides: splitSlides(norm),
    emphasis: defaultEmphasis(norm),
  };
}

export const LENGTH_LABEL: Record<LengthClass, string> = {
  corta: "Frase corta",
  media: "Frase media",
  larga: "Texto largo",
  "muy-larga": "Texto muy largo",
};

export interface Segment {
  text: string;
  em: boolean;
}

/** Marca las palabras destacadas dentro del texto (sin distinguir mayúsculas). */
export function splitEmphasis(text: string, emphasis: string[]): Segment[] {
  const phrases = emphasis.map((e) => e.trim()).filter(Boolean);
  if (!phrases.length) return [{ text, em: false }];
  const lower = text.toLocaleLowerCase("es");
  const ranges: [number, number][] = [];
  for (const p of phrases) {
    const i = lower.indexOf(p.toLocaleLowerCase("es"));
    if (i >= 0 && !ranges.some(([a, b]) => i < b && i + p.length > a)) ranges.push([i, i + p.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const out: Segment[] = [];
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a > pos) out.push({ text: text.slice(pos, a), em: false });
    out.push({ text: text.slice(a, b), em: true });
    pos = b;
  }
  if (pos < text.length) out.push({ text: text.slice(pos), em: false });
  return out;
}
