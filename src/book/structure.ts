import type { Block, Source } from "./model";
import { emptyEdits, mapRunText, runsToPlain, type BlockEdit, type BookEdits, type Insert } from "./edits";
import { applyFixes } from "./fixes";
import { chapterRuleOf, type BookOptions, type ChapterRule } from "./options";

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

/** Bloque listo para maquetar: con su clave, su ajuste y las páginas añadidas. */
export type KeyedBlock = (Block | { type: "insert"; insert: Insert }) & { key: string; edit?: BlockEdit };

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

/** «2024-03-14» → «14 de marzo de 2024». */
export function formatLongDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} de ${MONTHS[m - 1] ?? ""} de ${y}`;
}

export function formatDate(iso: string, withTime: boolean): string {
  const [d, t] = iso.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const short = MONTHS[m - 1]?.slice(0, 3) ?? "";
  const base = `${day} ${short} ${y}`;
  return withTime && t ? `${base} · ${t.slice(0, 5)}` : base;
}

type MsgBlock = Extract<KeyedBlock, { type: "message" }>;

const msgCount = (n: number) => `${n.toLocaleString("es")} ${n === 1 ? "mensaje" : "mensajes"}`;
const dayOf = (b: KeyedBlock) => (b.type === "message" && b.date ? b.date.slice(0, 10) : null);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** «14 de marzo – 2 de abril de 2024» o, entre años, con los dos años. */
export function dayRange(a: string, b: string): string {
  if (a === b) return formatLongDate(a);
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  if (ya !== yb) return `${formatLongDate(a)} – ${formatLongDate(b)}`;
  if (ma === mb) return `del ${da} al ${db} de ${MONTHS[ma - 1]} de ${ya}`;
  return `${da} de ${MONTHS[ma - 1]} – ${db} de ${MONTHS[mb - 1]} de ${ya}`;
}

function groupBy(keyed: KeyedBlock[], keyOf: (b: KeyedBlock) => string): [string, KeyedBlock[]][] {
  const groups = new Map<string, KeyedBlock[]>();
  for (const b of keyed) {
    const k = keyOf(b);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(b);
  }
  return Array.from(groups.entries());
}

function chatChapters(src: Source, rule: ChapterRule, silenceDays: number): Chapter[] {
  const keyed: KeyedBlock[] = src.blocks.map((b, i) => ({ ...b, key: `${src.id}:${i}` }));
  const msgsOf = (blocks: KeyedBlock[]) => blocks.filter((b): b is MsgBlock => b.type === "message");
  if (rule === "ninguno") return [{ key: `${src.id}:all`, title: src.name, blocks: keyed }];

  if (rule === "anio") {
    return groupBy(keyed, (b) => dayOf(b)?.slice(0, 4) ?? "sin-fecha").map(([y, blocks]) => {
      const msgs = msgsOf(blocks);
      const months = msgs.map((m) => (m.date ? Number(m.date.slice(5, 7)) : 0)).filter(Boolean);
      const range = months.length ? (Math.min(...months) === Math.max(...months) ? `en ${MONTHS[months[0] - 1]}` : `de ${MONTHS[Math.min(...months) - 1]} a ${MONTHS[Math.max(...months) - 1]}`) : "";
      return { key: `${src.id}:y${y}`, title: y === "sin-fecha" ? "Sin fecha" : y, subtitle: `${msgCount(msgs.length)}${range ? ` · ${range}` : ""}`, blocks };
    });
  }

  if (rule === "silencio") {
    const chapters: { blocks: KeyedBlock[]; gap: number }[] = [];
    let last: string | null = null;
    for (const b of keyed) {
      const day = dayOf(b);
      const gap = day && last ? daysBetween(last, day) : 0;
      if (!chapters.length || gap >= silenceDays) chapters.push({ blocks: [], gap });
      chapters[chapters.length - 1].blocks.push(b);
      if (day) last = day;
    }
    return chapters.map(({ blocks, gap }, i) => {
      const days = blocks.map(dayOf).filter((d): d is string => !!d);
      const title = days.length ? dayRange(days[0], days[days.length - 1]) : "Sin fecha";
      const after = gap ? ` · tras ${gap} días de silencio` : "";
      return { key: `${src.id}:s${i}:${days[0] ?? "x"}`, title: title.charAt(0).toUpperCase() + title.slice(1), subtitle: `${msgCount(msgsOf(blocks).length)}${after}`, blocks };
    });
  }

  return groupBy(keyed, (b) => dayOf(b)?.slice(0, 7) ?? "sin-fecha").map(([ym, blocks]) => {
    const msgs = msgsOf(blocks);
    const days = msgs.map((m) => (m.date ? Number(m.date.slice(8, 10)) : 0)).filter(Boolean);
    const month = ym === "sin-fecha" ? "" : MONTHS[Number(ym.slice(5, 7)) - 1];
    const range = days.length ? (Math.min(...days) === Math.max(...days) ? `el ${days[0]} de ${month}` : `del ${Math.min(...days)} al ${Math.max(...days)} de ${month}`) : "";
    return {
      key: `${src.id}:${ym}`,
      title: ym === "sin-fecha" ? "Sin fecha" : monthTitle(ym),
      subtitle: `${msgCount(msgs.length)}${range ? ` · ${range}` : ""}`,
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

export function buildChapters(sources: Source[], options: BookOptions, ai: AiResults = {}, edits: BookEdits = emptyEdits()): Chapter[] {
  const auto = sources.flatMap((s) =>
    s.kind === "whatsapp"
      ? chatChapters(s, chapterRuleOf(options), options.content.silenceDays)
      : proseChapters(s, options.ai.chapters ? ai.breaks?.[s.id] : undefined),
  );
  for (const c of auto) {
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
  const chapters = applyEdits(auto, edits);
  const fixes = options.fixes ?? {};
  if (Object.keys(fixes).length) {
    for (const c of chapters) {
      c.blocks = c.blocks.map((b) => {
        if (b.type !== "paragraph" && b.type !== "message") return b;
        const edit = b.edit?.runs ? { ...b.edit, runs: mapRunText(b.edit.runs, (t) => applyFixes(t, fixes)) } : b.edit;
        return { ...b, text: applyFixes(b.text, fixes), edit };
      });
    }
  }
  return chapters;
}

/**
 * Lo que decidió el usuario: quita los bloques ocultos y las fotos quitadas,
 * cambia el texto editado, corta capítulos donde lo pidió y coloca las
 * páginas añadidas antes o después de su bloque.
 */
function applyEdits(chapters: Chapter[], edits: BookEdits): Chapter[] {
  if (!Object.keys(edits.blocks).length && !edits.inserts.length) return chapters;
  const before = new Map<string, Insert[]>();
  const after = new Map<string, Insert[]>();
  for (const ins of edits.inserts) {
    const m = ins.side === "antes" ? before : after;
    m.set(ins.at, [...(m.get(ins.at) ?? []), ins]);
  }
  const insertBlocks = (list: Insert[] | undefined): KeyedBlock[] => (list ?? []).map((insert) => ({ type: "insert", insert, key: `ins:${insert.id}` }));

  const out: Chapter[] = [];
  for (const c of chapters) {
    let cur: Chapter = { ...c, blocks: [] };
    out.push(cur);
    for (const b of c.blocks) {
      const e = edits.blocks[b.key];
      cur.blocks.push(...insertBlocks(before.get(b.key)));
      if (e?.chapter) {
        const title = e.chapter.title.trim() || "Sin título";
        if (!cur.blocks.length) {
          // Primer bloque del capítulo: se renombra en vez de dejar uno vacío.
          cur.title = title;
          cur.subtitle = e.chapter.subtitle || undefined;
        } else {
          cur = { key: `${b.key}:cap`, title, subtitle: e.chapter.subtitle || undefined, blocks: [] };
          out.push(cur);
        }
      }
      if (!e?.hidden) cur.blocks.push(e ? withEdit(b, e) : b);
      cur.blocks.push(...insertBlocks(after.get(b.key)));
    }
  }
  return out;
}

function withEdit(b: KeyedBlock, e: BlockEdit): KeyedBlock {
  if (b.type === "message") {
    const hidden = new Set(e.photos?.hidden ?? []);
    return { ...b, edit: e, text: e.runs ? runsToPlain(e.runs) : b.text, media: hidden.size ? b.media.filter((m) => !hidden.has(m)) : b.media };
  }
  if (b.type === "paragraph") return { ...b, edit: e, text: e.runs ? runsToPlain(e.runs) : b.text };
  return { ...b, edit: e };
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
