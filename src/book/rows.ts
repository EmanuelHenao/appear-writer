import { isHighlighted, type BookEdits } from "./edits";
import type { Source } from "./model";
import type { BookOptions } from "./options";
import { buildChapters, type AiResults } from "./structure";

// Filas de la lista del paso Contenido: los capítulos tal como quedarán
// (con los cortes a mano), cada mensaje o párrafo, incluidos los ocultos,
// y las páginas añadidas.

export type Row =
  | { kind: "chapter"; key: string; title: string; manual: boolean }
  | { kind: "block"; key: string; author: string; date: string | null; text: string; media: string[]; chapter: string; isMessage: boolean }
  | { kind: "insert"; key: string; insertId: string; label: string; chapter: string };

export const INSERT_LABEL = { separador: "Separador", libre: "Página libre", imagen: "Imagen", blanco: "Página en blanco" } as const;

/**
 * Lo único de las ediciones que cambia las filas: los cortes de capítulo a
 * mano y las páginas añadidas. Ocultar, destacar o editar no las cambia
 * (la lista lo lee de las ediciones al pintar), así que la lista solo se
 * rehace cuando cambia esta clave.
 */
export function structuralKey(edits: BookEdits): string {
  const chapters: [string, unknown][] = [];
  for (const k in edits.blocks) if (edits.blocks[k].chapter) chapters.push([k, edits.blocks[k].chapter]);
  return JSON.stringify({ chapters, inserts: edits.inserts });
}

export function structuralEdits(key: string): BookEdits {
  const { chapters, inserts } = JSON.parse(key) as { chapters: [string, BookEdits["blocks"][string]["chapter"]][]; inserts: BookEdits["inserts"] };
  return { blocks: Object.fromEntries(chapters.map(([k, chapter]) => [k, { chapter }])), inserts };
}

export function buildRows(sources: Source[], options: BookOptions, ai: AiResults, edits: BookEdits): Row[] {
  // Los capítulos salen de las reglas y los cortes a mano; los ocultos se
  // vuelven a poner en su sitio para poder mostrarlos en la lista.
  const structural = structuralEdits(structuralKey(edits));
  const original = new Map<string, Source["blocks"][number]>();
  for (const s of sources) s.blocks.forEach((b, i) => original.set(`${s.id}:${i}`, b));

  const rows: Row[] = [];
  for (const c of buildChapters(sources, { ...options, fixes: {} }, ai, structural)) {
    rows.push({ kind: "chapter", key: `cap:${c.key}`, title: c.title, manual: c.key.endsWith(":cap") || !!edits.blocks[c.blocks.find((b) => b.type !== "insert")?.key ?? ""]?.chapter });
    for (const b of c.blocks) {
      if (b.type === "insert") {
        rows.push({ kind: "insert", key: b.key, insertId: b.insert.id, label: `${INSERT_LABEL[b.insert.kind]}${b.insert.title ? ` · «${b.insert.title}»` : b.insert.caption ? ` · ${b.insert.caption}` : ""}`, chapter: c.title });
        continue;
      }
      const o = original.get(b.key);
      if (!o) continue;
      if (o.type === "message") rows.push({ kind: "block", key: b.key, author: o.author, date: o.date, text: o.text, media: o.media, chapter: c.title, isMessage: true });
      else if (o.type === "paragraph") rows.push({ kind: "block", key: b.key, author: "", date: null, text: o.text, media: [], chapter: c.title, isMessage: false });
    }
  }
  return rows;
}

export type StateFilter = "todos" | "ocultos" | "destacados" | "editados";

export interface RowFilter {
  q: string;
  author: string;
  from: string;
  to: string;
  photos: boolean;
  state: StateFilter;
}

export const NO_FILTER: RowFilter = { q: "", author: "", from: "", to: "", photos: false, state: "todos" };

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
// El texto de búsqueda de cada fila se normaliza una sola vez, no en cada tecla.
const folded = new WeakMap<Row, string>();
function searchText(r: Extract<Row, { kind: "block" }>): string {
  let t = folded.get(r);
  if (t === undefined) folded.set(r, (t = fold(`${r.author} ${r.text}`)));
  return t;
}

export function isFiltering(f: RowFilter) {
  return !!(f.q.trim() || f.author || f.from || f.to || f.photos || f.state !== "todos");
}

/** Aplica los filtros; los capítulos se quedan solo si les queda alguna fila. */
export function filterRows(rows: Row[], f: RowFilter, edits: BookEdits): Row[] {
  if (!isFiltering(f)) return rows;
  const q = fold(f.q.trim());
  const keep = (r: Row): boolean => {
    if (r.kind === "chapter") return false;
    if (r.kind === "insert") return !q && !f.author && !f.from && !f.to && !f.photos && (f.state === "todos" || f.state === "editados");
    const e = edits.blocks[r.key];
    if (q && !searchText(r).includes(q)) return false;
    if (f.author && r.author !== f.author) return false;
    const day = r.date?.slice(0, 10) ?? "";
    if (f.from && (!day || day < f.from)) return false;
    if (f.to && (!day || day > f.to)) return false;
    if (f.photos && !r.media.length) return false;
    if (f.state === "ocultos" && !e?.hidden) return false;
    if (f.state === "destacados" && !isHighlighted(e)) return false;
    if (f.state === "editados" && !e) return false;
    return true;
  };
  const out: Row[] = [];
  let pending: Row | null = null;
  for (const r of rows) {
    if (r.kind === "chapter") {
      pending = r;
      continue;
    }
    if (!keep(r)) continue;
    if (pending) {
      out.push(pending);
      pending = null;
    }
    out.push(r);
  }
  return out;
}

export function editsSummary(edits: BookEdits): { hidden: number; highlighted: number; inserts: number; chapters: number; edited: number } {
  const sum = { hidden: 0, highlighted: 0, inserts: edits.inserts.length, chapters: 0, edited: 0 };
  for (const e of Object.values(edits.blocks)) {
    if (e.hidden) sum.hidden++;
    else if (isHighlighted(e)) sum.highlighted++;
    if (e.chapter) sum.chapters++;
    if (e.runs) sum.edited++;
  }
  return sum;
}
