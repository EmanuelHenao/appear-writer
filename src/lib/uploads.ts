import "server-only";
import { readdir, rm, stat } from "node:fs/promises";
import type { PhotoRef } from "@/design/spec";
import { dataPath, newId, writeBinary } from "./storage";

// Fotos propias del usuario (fondos de imágenes y aperturas de capítulo).
// Viven en DATA_DIR/uploads/propias y se sirven por /api/files.

const DIR = ["uploads", "propias"];
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_UPLOAD = 15 * 1024 * 1024;

const ref = (name: string): PhotoRef => {
  const url = `/api/files/${DIR.join("/")}/${name}`;
  return { url, thumb: url, source: "subida" };
};

export function isUploadName(name: string): boolean {
  return /^[a-z0-9-]+\.(jpg|png|webp)$/.test(name);
}

/** Motivo por el que no se acepta la foto, o null si vale. */
export function uploadProblem(file: File): string | null {
  if (!TYPES[file.type]) return `«${file.name}» no es JPG, PNG ni WEBP.`;
  if (file.size > MAX_UPLOAD) return `«${file.name}» pasa de 15 MB.`;
  return null;
}

export async function saveUpload(file: File): Promise<PhotoRef> {
  const ext = TYPES[file.type];
  const name = `${newId()}.${ext}`;
  await writeBinary(dataPath(...DIR, name), Buffer.from(await file.arrayBuffer()));
  return ref(name);
}

/** Las subidas, de la más reciente a la más antigua. */
export async function listUploads(): Promise<PhotoRef[]> {
  try {
    const names = (await readdir(dataPath(...DIR))).filter(isUploadName);
    const dated = await Promise.all(names.map(async (n) => ({ n, t: (await stat(dataPath(...DIR, n))).mtimeMs })));
    return dated.sort((a, b) => b.t - a.t).map((d) => ref(d.n));
  } catch {
    return [];
  }
}

export async function removeUpload(name: string): Promise<void> {
  if (!isUploadName(name)) throw new Error("Nombre de foto no válido.");
  await rm(dataPath(...DIR, name), { force: true });
}
