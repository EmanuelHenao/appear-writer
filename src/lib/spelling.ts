import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import nspell from "nspell";
import { isLaugh } from "@/book/suggest";
import { nodeModules } from "./render/fontcss";

// Revisión ortográfica sin IA ni conexión: diccionario Hunspell de español
// (dictionary-es) con nspell. Solo propone; el usuario marca qué se cambia.

export interface SpellIssue {
  word: string;
  count: number;
  suggestions: string[];
  /** tilde: solo le falta una tilde o la ñ (casi siempre acierta); jerga: abreviatura de chat. */
  kind: "tilde" | "jerga" | "otra";
  example: string;
}

type Speller = ReturnType<typeof nspell>;
let speller: Promise<Speller> | null = null;

function getSpeller(): Promise<Speller> {
  speller ??= (async () => {
    const dir = path.join(nodeModules(), "dictionary-es");
    const [aff, dic] = await Promise.all([readFile(path.join(dir, "index.aff")), readFile(path.join(dir, "index.dic"))]);
    return nspell({ aff, dic });
  })();
  return speller;
}

/** Abreviaturas de chat frecuentes. Se proponen, nunca se cambian solas. */
const SLANG: Record<string, string[]> = {
  q: ["que"],
  k: ["que"],
  xq: ["porque", "por qué"],
  pq: ["porque", "por qué"],
  porq: ["porque", "por qué"],
  tb: ["también"],
  tmb: ["también"],
  tambien: ["también"],
  xfa: ["por favor"],
  porfa: ["por favor"],
  xa: ["para"],
  pa: ["para"],
  dnd: ["dónde", "donde"],
  bn: ["bien"],
  msj: ["mensaje"],
  tqm: ["te quiero mucho"],
  nose: ["no sé"],
  aki: ["aquí"],
  aca: ["acá"],
  alla: ["allá"],
  ntp: ["no te preocupes"],
};

const VOWEL_ACCENT: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };

/** Variantes con una tilde o con ñ que el diccionario acepta. */
function accentFixes(sp: Speller, w: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i < w.length; i++) {
    const c = w[i];
    const rep = VOWEL_ACCENT[c] ?? (c === "n" ? "ñ" : null);
    if (!rep) continue;
    const v = w.slice(0, i) + rep + w.slice(i + 1);
    if (sp.correct(v)) out.add(v);
  }
  return [...out];
}

const strip = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "");

/**
 * Palabras desconocidas en los textos, de la más repetida a la menos.
 * `names` (participantes, títulos) nunca se marcan.
 */
export async function checkSpelling(texts: string[], names: string[] = [], limit = 150): Promise<SpellIssue[]> {
  const sp = await getSpeller();
  const skip = new Set(names.flatMap((n) => n.toLowerCase().split(/\s+/)));
  const seen = new Map<string, { count: number; midCap: boolean; example: string }>();
  for (const text of texts) {
    const re = /\p{L}+/gu;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const raw = m[0];
      const w = raw.toLowerCase();
      if (skip.has(w) || isLaugh(w) || /\d/.test(raw) || (raw.length > 1 && raw === raw.toUpperCase() && !SLANG[w])) continue;
      const before = text.slice(Math.max(0, m.index - 3), m.index);
      const sentenceStart = m.index === 0 || /[.!?¡¿\n]\s*$/.test(before);
      const cap = raw[0] !== raw[0].toLowerCase();
      const e = seen.get(w);
      if (e) {
        e.count++;
        if (cap && !sentenceStart) e.midCap = true;
      } else {
        const s = Math.max(0, m.index - 30);
        seen.set(w, { count: 1, midCap: cap && !sentenceStart, example: `${s ? "…" : ""}${text.slice(s, m.index + raw.length + 30).replace(/\s+/g, " ").trim()}…` });
      }
    }
  }

  const issues: SpellIssue[] = [];
  const ranked = [...seen.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [w, e] of ranked) {
    if (issues.length >= limit) break;
    if (SLANG[w]) {
      issues.push({ word: w, count: e.count, suggestions: SLANG[w], kind: "jerga", example: e.example });
      continue;
    }
    // Una palabra con mayúscula en medio de la frase es casi siempre un nombre propio.
    if (e.midCap || w.length < 3 || sp.correct(w)) continue;
    const accents = accentFixes(sp, w);
    if (accents.length) {
      issues.push({ word: w, count: e.count, suggestions: accents, kind: "tilde", example: e.example });
      continue;
    }
    if (w.length > 14) continue;
    const sug = sp.suggest(w);
    // Primero las que solo cambian tildes; luego el resto del diccionario.
    sug.sort((a, b) => Number(strip(b) === strip(w)) - Number(strip(a) === strip(w)));
    if (sug.length) issues.push({ word: w, count: e.count, suggestions: sug.slice(0, 4), kind: "otra", example: e.example });
  }
  return issues;
}
