import "server-only";
import type { PhotoRef } from "@/design/spec";
import { stat } from "node:fs/promises";
import { dataPath, isSafeId, listDirs, newId, readJson, removeDir, writeJson } from "@/lib/storage";
import { emptyEdits, normalizeEdits, type BookEdits } from "./edits";
import type { Source } from "./model";
import { BookOptionsSchema, suggestedBookOptions, type BookOptions } from "./options";
import type { AiResults } from "./structure";

export interface BookProject {
  id: string;
  createdAt: string;
  updatedAt: string;
  sources: Source[];
  options: BookOptions;
  /** true cuando el usuario ya tocó las opciones: no se vuelven a sugerir. */
  optionsTouched: boolean;
  ai: AiResults & { titleSuggestion?: { titulo: string; subtitulo: string }; coverReason?: string };
  stock: { query: string; photos: PhotoRef[] };
  /** Lo decidido sobre cada mensaje y las páginas añadidas (paso Contenido). */
  edits: BookEdits;
  lastPages?: number;
  hasCover?: boolean;
}

const file = (id: string) => dataPath("books", id, "book.json");

export async function createBook(): Promise<BookProject> {
  const now = new Date().toISOString();
  const book: BookProject = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    sources: [],
    options: suggestedBookOptions([]),
    optionsTouched: false,
    ai: {},
    stock: { query: "", photos: [] },
    edits: emptyEdits(),
  };
  await saveBook(book);
  return book;
}

// El último estado de cada libro queda en memoria (un chat puede pesar
// decenas de MB): leerlo y parsearlo en cada petición sería lo más caro de
// cada edición. Se invalida por la fecha de modificación del archivo.
const cache = new Map<string, { mtime: number; book: BookProject }>();

/**
 * Copia para quien la pida: lo pequeño se duplica y las fuentes se
 * comparten (nunca se modifican en su sitio; se reemplazan).
 */
function copyOf(b: BookProject): BookProject {
  return { ...b, sources: [...b.sources], options: structuredClone(b.options), ai: structuredClone(b.ai), stock: structuredClone(b.stock), edits: structuredClone(b.edits) };
}

async function mtimeOf(id: string): Promise<number | null> {
  try {
    return (await stat(file(id))).mtimeMs;
  } catch {
    return null;
  }
}

export async function getBook(id: string): Promise<BookProject | null> {
  if (!isSafeId(id)) return null;
  const mtime = await mtimeOf(id);
  if (mtime === null) return null;
  const hit = cache.get(id);
  if (hit && hit.mtime === mtime) return copyOf(hit.book);
  const b = await readJson<BookProject | null>(file(id), null);
  if (!b) return null;
  const parsed = BookOptionsSchema.safeParse(b.options);
  // Los campos nuevos de versiones posteriores toman su valor por defecto.
  if (parsed.success) b.options = parsed.data;
  else b.options = { ...suggestedBookOptions(b.sources), cover: b.options?.cover ?? suggestedBookOptions(b.sources).cover };
  b.edits = normalizeEdits(b.edits);
  cache.set(id, { mtime, book: b });
  return copyOf(b);
}

export async function saveBook(b: BookProject): Promise<void> {
  b.updatedAt = new Date().toISOString();
  await writeJson(file(b.id), b, false);
  const mtime = await mtimeOf(b.id);
  if (mtime !== null) cache.set(b.id, { mtime, book: copyOf(b) });
}

export async function listBooks() {
  const ids = (await listDirs(dataPath("books"))).filter(isSafeId);
  const books = await Promise.all(ids.map((id) => getBook(id)));
  return books
    .filter((b): b is BookProject => !!b && b.sources.length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((b) => ({
      id: b.id,
      title: b.options.cover.title || "Sin título",
      updatedAt: b.updatedAt,
      sources: b.sources.length,
      coverUrl: `/api/books/${b.id}/cover?v=${encodeURIComponent(b.updatedAt)}`,
    }));
}

export async function deleteBook(id: string) {
  if (!isSafeId(id)) return false;
  cache.delete(id);
  await removeDir(dataPath("books", id));
  return true;
}

/** Al añadir fuentes, se recalculan las sugerencias si el usuario no tocó nada. */
export function refreshSuggestions(b: BookProject) {
  if (!b.optionsTouched) b.options = suggestedBookOptions(b.sources);
}

/** Resumen corto del libro para las tareas de IA. */
export function bookSummary(b: BookProject, max = 3500): string {
  const lines: string[] = [];
  for (const s of b.sources) {
    lines.push(`Fuente: ${s.name} (${s.kind})${s.meta.participants ? `, participantes: ${s.meta.participants.join(", ")}` : ""}${s.meta.firstDate ? `, de ${s.meta.firstDate.slice(0, 10)} a ${s.meta.lastDate?.slice(0, 10)}` : ""}`);
    for (const blk of s.blocks.slice(0, 40)) {
      if (blk.type === "message") lines.push(`${blk.author}: ${blk.text.slice(0, 200)}`);
      else if (blk.type === "paragraph" || blk.type === "heading") lines.push(blk.text.slice(0, 300));
    }
  }
  return lines.join("\n").slice(0, max);
}
