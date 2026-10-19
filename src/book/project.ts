import "server-only";
import type { PhotoRef } from "@/design/spec";
import { dataPath, isSafeId, listDirs, newId, readJson, removeDir, writeJson } from "@/lib/storage";
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
  };
  await saveBook(book);
  return book;
}

export async function getBook(id: string): Promise<BookProject | null> {
  if (!isSafeId(id)) return null;
  const b = await readJson<BookProject | null>(file(id), null);
  if (!b) return null;
  const parsed = BookOptionsSchema.safeParse(b.options);
  if (!parsed.success) b.options = { ...suggestedBookOptions(b.sources), cover: b.options?.cover ?? suggestedBookOptions(b.sources).cover };
  return b;
}

export async function saveBook(b: BookProject): Promise<void> {
  b.updatedAt = new Date().toISOString();
  await writeJson(file(b.id), b);
}

export async function listBooks() {
  const ids = (await listDirs(dataPath("books"))).filter(isSafeId);
  const books = await Promise.all(ids.map((id) => readJson<BookProject | null>(file(id), null)));
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
