import type { Block } from "@/book/model";

// Texto plano o pegado. Los párrafos se separan por líneas en blanco y se
// conservan los saltos de línea internos (importante en poesía).

const CHAPTER = /^(cap[ií]tulo|parte|chapter|part)\s+([0-9ivxlcdm]+|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b.*$/i;

export function parsePlainText(raw: string): Block[] {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
  const blocks: Block[] = [];
  for (const chunk of text.split(/\n\s*\n+/)) {
    const para = chunk.replace(/^\n+|\n+$/g, "");
    if (!para.trim()) continue;
    const first = para.split("\n")[0].trim();
    const md = first.match(/^(#{1,3})\s+(.+)$/);
    if (md) {
      blocks.push({ type: "heading", text: md[2].trim(), level: md[1].length === 1 ? 1 : 2 });
      const rest = para.split("\n").slice(1).join("\n").trim();
      if (rest) blocks.push({ type: "paragraph", text: rest });
      continue;
    }
    if (CHAPTER.test(first) && first.length <= 80 && !para.includes("\n")) {
      blocks.push({ type: "heading", text: first, level: 1 });
      continue;
    }
    blocks.push({ type: "paragraph", text: para });
  }
  return blocks;
}

/**
 * Reconstruye párrafos a partir del texto de un PDF, donde cada línea
 * visual termina en salto de línea. Une palabras cortadas con guion.
 */
export function paragraphsFromPdfText(pages: string[]): string[] {
  const lines = pages
    .flatMap((p) => p.replace(/\r/g, "").split("\n"))
    .map((l) => l.replace(/\s+/g, " ").trim());
  const filtered = lines.filter((l) => !/^\d{1,4}$/.test(l)); // números de página
  const lengths = filtered.filter((l) => l.length > 20).map((l) => l.length).sort((a, b) => a - b);
  const typical = lengths.length ? lengths[Math.floor(lengths.length * 0.8)] : 70;
  const paras: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) paras.push(cur.trim());
    cur = "";
  };
  for (const line of filtered) {
    if (!line) {
      flush();
      continue;
    }
    if (cur.endsWith("-") && /^[a-záéíóúñü]/.test(line)) {
      cur = cur.slice(0, -1) + line;
    } else {
      cur = cur ? `${cur} ${line}` : line;
    }
    // Una línea corta que cierra frase suele terminar el párrafo.
    if (/[.!?:»”"]$/.test(line) && line.length < typical * 0.75) flush();
  }
  flush();
  return paras;
}
