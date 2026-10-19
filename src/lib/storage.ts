import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// Todo se guarda en archivos dentro de DATA_DIR (por defecto ./data).
// Es una app de una sola persona: JSON por elemento y archivos al lado.

export function dataDir(): string {
  return path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
}

/** Une segmentos bajo DATA_DIR y se niega a salir de él. */
export function dataPath(...segments: string[]): string {
  const root = dataDir();
  const p = path.resolve(root, ...segments);
  if (p !== root && !p.startsWith(root + path.sep)) throw new Error("Ruta fuera del directorio de datos");
  return p;
}

export function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 16);
}

export function isSafeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(file: string, value: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  const { rename } = await import("node:fs/promises");
  await rename(tmp, file);
}

export async function writeBinary(file: string, data: Buffer | Uint8Array): Promise<void> {
  await ensureDir(path.dirname(file));
  await writeFile(file, data);
}

export async function listDirs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

export async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

export async function removeDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".epub": "application/epub+zip",
  ".zip": "application/zip",
  ".html": "text/html; charset=utf-8",
  ".opus": "audio/ogg",
  ".mp4": "video/mp4",
};

export function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}
