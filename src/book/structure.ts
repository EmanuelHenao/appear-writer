import type { Block, Source } from "./model";
import type { BookOptions } from "./options";

// Arma los capítulos de forma determinista. La IA solo puede aportar
// títulos, cortes o correcciones, y solo si su casilla está marcada.

export interface AiResults {
  /** Título por clave de capítulo. */
  chapterTitles?: Record<string, string>;
  /** Cortes propuestos para fuentes sin títulos, por id de fuente. */
  breaks?: Record<string, { inicio: number; titulo: string }[]>;
  /** Texto corregido por clave de bloque («fuente:índice»). */
  corrections?: Record<string, string>;
}

export type KeyedBlock = Block & { key: string };

export interface Chapter {
  key: string;
  title: string;
  subtitle?: string;
  blocks: KeyedBlock[];
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function monthTitle(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const name = MONTHS[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

export function formatDate(iso: string, withTime: boolean): string {
  const [d, t] = iso.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const short = MONTHS[m - 1]?.slice(0, 3) ?? "";
  const base = `${day} ${short} ${y}`;
  return withTime && t ? `${base} · ${t.slice(0, 5)}` : base;
}

function chatChapters(src: Source, byMonth: boolean): Chapter[] {
  const keyed: KeyedBlock[] = src.blocks.map((b, i) => ({ ...b, key: `${src.id}:${i}` }));
  if (!byMonth) return [{ key: `${src.id}:all`, title: src.name, blocks: keyed }];
  const groups = new Map<string, KeyedBlock[]>();
  for (const b of keyed) {
    const ym = b.type === "message" && b.date ? b.date.slice(0, 7) : "sin-fecha";
    if (!groups.has(ym)) groups.set(ym, []);
    groups.get(ym)!.push(b);
  }
  return Array.from(groups.entries()).map(([ym, blocks]) => {
    const msgs = blocks.filter((b): b is Extract<KeyedBlock, { type: "message" }> => b.type === "message");
    const days = msgs.map((m) => (m.date ? Number(m.date.slice(8, 10)) : 0)).filter(Boolean);
    const month = ym === "sin-fecha" ? "" : MONTHS[Number(ym.slice(5, 7)) - 1];
    const range = days.length ? (Math.min(...days) === Math.max(...days) ? `el ${days[0]} de ${month}` : `del ${Math.min(...days)} al ${Math.max(...days)} de ${month}`) : "";
    return {
      key: `${src.id}:${ym}`,
      title: ym === "sin-fecha" ? "Sin fecha" : monthTitle(ym),
      subtitle: `${msgs.length.toLocaleString("es")} ${msgs.length === 1 ? "mensaje" : "mensajes"}${range ? ` · ${range}` : ""}`,
      blocks,
    };
  });
}

function proseChapters(src: Source, breaks?: { inicio: number; titulo: string }[]): Chapter[] {
  const keyed: KeyedBlock[] = src.blocks.map((b, i) => ({ ...b, key: `${src.id}:${i}` }));
  if (breaks?.length) {
    const sorted = [...breaks].sort((a, b) => a.inicio - b.inicio);
    if (sorted[0].inicio !== 0) sorted.unshift({ inicio: 0, titulo: src.name });
    return sorted.map((br, i) => ({
      key: `${src.id}:ia${i}`,
      title: br.titulo,
      blocks: keyed.slice(br.inicio, sorted[i + 1]?.inicio ?? keyed.length),
    }));
  }
  const chapters: Chapter[] = [];
  let cur: Chapter | null = null;
  for (const [i, b] of keyed.entries()) {
    if (b.type === "heading" && b.level === 1) {
      cur = { key: `${src.id}:h${i}`, title: b.text, blocks: [] };
      chapters.push(cur);
      continue;
    }
    if (!cur) {
      cur = { key: `${src.id}:inicio`, title: src.name, blocks: [] };
      chapters.push(cur);
    }
    cur.blocks.push(b);
  }
  return chapters.filter((c) => c.blocks.length);
}

export function buildChapters(sources: Source[], options: BookOptions, ai: AiResults = {}): Chapter[] {
  const chapters = sources.flatMap((s) =>
    s.kind === "whatsapp"
      ? chatChapters(s, options.content.chaptersByMonth)
      : proseChapters(s, options.ai.chapters ? ai.breaks?.[s.id] : undefined),
  );
  for (const c of chapters) {
    if (options.ai.chapters && ai.chapterTitles?.[c.key]) {
      if (c.subtitle === undefined) c.subtitle = c.title;
      else c.subtitle = `${c.title} · ${c.subtitle}`;
      c.title = ai.chapterTitles[c.key];
    }
    if (options.ai.spelling && ai.corrections) {
      c.blocks = c.blocks.map((b) =>
        (b.type === "paragraph" || b.type === "message") && ai.corrections![b.key] ? { ...b, text: ai.corrections![b.key] } : b,
      );
    }
  }
  return chapters;
}

/** Fragmento corto de cada capítulo para pedir títulos a la IA. */
export function chapterExcerpt(c: Chapter, max = 600): string {
  const parts: string[] = [];
  for (const b of c.blocks) {
    if (b.type === "paragraph" || b.type === "heading") parts.push(b.text);
    else if (b.type === "message") parts.push(`${b.author}: ${b.text}`);
    if (parts.join("\n").length > max) break;
  }
  return parts.join("\n").slice(0, max);
}
