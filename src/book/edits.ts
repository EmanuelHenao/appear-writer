import { z } from "zod";

// Lo que el usuario decide sobre cada bloque (mensaje o párrafo) y las
// páginas que añade. Se guarda aparte del contenido de las fuentes, que
// nunca se toca, y se aplica al maquetar. La clave de un bloque es la de
// `structure.ts`: «idFuente:índice».

export const RUN_FONTS = ["cormorant", "caslon", "lora", "fraunces"] as const;
export const RUN_SIZES = ["s", "m", "l", "xl"] as const;
export const RUN_COLORS = ["ink", "accent", "deep", "muted"] as const;

export const RunSchema = z.object({
  t: z.string().max(20000),
  b: z.boolean().optional(),
  i: z.boolean().optional(),
  u: z.boolean().optional(),
  font: z.enum(RUN_FONTS).optional(),
  size: z.enum(RUN_SIZES).optional(),
  color: z.enum(RUN_COLORS).optional(),
});
export type Run = z.infer<typeof RunSchema>;
export type RunStyle = Omit<Run, "t">;

export const BLOCK_DESIGNS = ["normal", "cita", "foto-completa", "foto-texto"] as const;
export type BlockDesign = (typeof BLOCK_DESIGNS)[number];

export const PHOTO_PLACES = ["junto", "antes", "ambas"] as const;

export const BlockEditSchema = z.object({
  hidden: z.boolean().optional(),
  design: z.enum(BLOCK_DESIGNS).optional(),
  /** Con «foto-completa»: el texto en la página siguiente o sobre la foto. */
  photoText: z.enum(["siguiente", "encima"]).optional(),
  /** Texto editado (y con formato). Sin él se usa el original. */
  runs: z.array(RunSchema).max(400).optional(),
  align: z.enum(["izquierda", "centro", "derecha"]).optional(),
  /** Empieza un capítulo en este bloque. */
  chapter: z.object({ title: z.string().max(160), subtitle: z.string().max(200).optional() }).optional(),
  photos: z.object({ hidden: z.array(z.string()).max(200).default([]), place: z.enum(PHOTO_PLACES).default("junto") }).optional(),
});
export type BlockEdit = z.infer<typeof BlockEditSchema>;

export const INSERT_KINDS = ["separador", "libre", "imagen", "blanco"] as const;

export const InsertSchema = z.object({
  id: z.string().min(1).max(40),
  at: z.string().max(200),
  side: z.enum(["antes", "despues"]),
  kind: z.enum(INSERT_KINDS),
  title: z.string().max(160).optional(),
  runs: z.array(RunSchema).max(400).optional(),
  photo: z.object({ url: z.string(), thumb: z.string().optional(), credit: z.string().optional() }).optional(),
  fit: z.enum(["completa", "enmarcada"]).optional(),
  caption: z.string().max(200).optional(),
});
export type Insert = z.infer<typeof InsertSchema>;

export const BookEditsSchema = z.object({
  blocks: z.record(z.string(), BlockEditSchema).default({}),
  inserts: z.array(InsertSchema).max(500).default([]),
});
export type BookEdits = z.infer<typeof BookEditsSchema>;

export const emptyEdits = (): BookEdits => ({ blocks: {}, inserts: [] });

export function normalizeEdits(raw: unknown): BookEdits {
  const p = BookEditsSchema.safeParse(raw ?? {});
  return p.success ? p.data : emptyEdits();
}

/** Un ajuste vacío no se guarda: así «restablecer» deja el bloque como estaba. */
export function isEmptyEdit(e: BlockEdit | undefined): boolean {
  if (!e) return true;
  return (
    !e.hidden &&
    (!e.design || e.design === "normal") &&
    !e.runs &&
    !e.align &&
    !e.chapter &&
    (!e.photos || (!e.photos.hidden.length && e.photos.place === "junto"))
  );
}

/** Aplica un cambio a un bloque y quita la entrada si queda vacía. */
export function setBlockEdit(edits: BookEdits, key: string, patch: Partial<BlockEdit> | null): BookEdits {
  const blocks = { ...edits.blocks };
  const next: BlockEdit = patch === null ? {} : { ...blocks[key], ...patch };
  for (const k of Object.keys(next) as (keyof BlockEdit)[]) if (next[k] === undefined) delete next[k];
  if (isEmptyEdit(next)) delete blocks[key];
  else blocks[key] = next;
  return { ...edits, blocks };
}

export const isHighlighted = (e: BlockEdit | undefined) => !!e?.design && e.design !== "normal";

// ── Texto con formato ─────────────────────────────────────────────

const sameStyle = (a: RunStyle, b: RunStyle) =>
  !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && a.font === b.font && a.size === b.size && a.color === b.color;

const styleOf = ({ t: _t, ...s }: Run): RunStyle => s;

function clean(s: RunStyle): RunStyle {
  const out: RunStyle = {};
  if (s.b) out.b = true;
  if (s.i) out.i = true;
  if (s.u) out.u = true;
  if (s.font) out.font = s.font;
  if (s.size) out.size = s.size;
  if (s.color) out.color = s.color;
  return out;
}

/** Une los tramos contiguos con el mismo estilo y quita los vacíos. */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (!r.t) continue;
    const s = clean(styleOf(r));
    const last = out[out.length - 1];
    if (last && sameStyle(styleOf(last), s)) last.t += r.t;
    else out.push({ t: r.t, ...s });
  }
  return out;
}

export const runsToPlain = (runs: Run[]) => runs.map((r) => r.t).join("");
export const plainToRuns = (text: string): Run[] => (text ? [{ t: text }] : []);
export const hasFormat = (runs: Run[] | undefined) => !!runs?.some((r) => Object.keys(clean(styleOf(r))).length);

/**
 * Aplica un estilo al rango [start, end) del texto. Un valor `undefined` o
 * `false` en `patch` quita ese estilo. Sin rango (start === end) se aplica
 * a todo el texto.
 */
export function applyStyle(runs: Run[], start: number, end: number, patch: Partial<RunStyle>): Run[] {
  const total = runsToPlain(runs).length;
  if (start === end) {
    start = 0;
    end = total;
  }
  [start, end] = [Math.max(0, Math.min(start, end)), Math.min(total, Math.max(start, end))];
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const a = pos;
    const b = pos + r.t.length;
    pos = b;
    if (b <= start || a >= end) {
      out.push(r);
      continue;
    }
    const from = Math.max(start, a) - a;
    const to = Math.min(end, b) - a;
    if (from > 0) out.push({ ...r, t: r.t.slice(0, from) });
    out.push({ ...r, ...patch, t: r.t.slice(from, to) } as Run);
    if (to < r.t.length) out.push({ ...r, t: r.t.slice(to) });
  }
  return normalizeRuns(out);
}

/** ¿Todo el rango tiene ese estilo? Sirve para que B/I/U funcionen como interruptor. */
export function rangeHas(runs: Run[], start: number, end: number, key: "b" | "i" | "u"): boolean {
  if (start === end) {
    start = 0;
    end = runsToPlain(runs).length;
  }
  let pos = 0;
  let any = false;
  for (const r of runs) {
    const a = pos;
    const b = pos + r.t.length;
    pos = b;
    if (b <= start || a >= end) continue;
    any = true;
    if (!r[key]) return false;
  }
  return any;
}

/** Aplica una función de texto (correcciones de ortografía) a cada tramo. */
export const mapRunText = (runs: Run[], fn: (t: string) => string): Run[] => runs.map((r) => ({ ...r, t: fn(r.t) }));
