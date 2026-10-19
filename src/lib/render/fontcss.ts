import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FONTS, type FontId } from "@/design/fonts";

// Genera @font-face para el documento que abre Chromium. Lee las hojas de
// @fontsource, conserva el subconjunto latino (cubre todo el español) y
// reescribe las URL para que apunten a `${base}fonts/<paquete>/files/...`.

const cache = new Map<string, string>();

export function nodeModules(): string {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "node_modules");
}

async function sheet(cssPath: string): Promise<string> {
  const hit = cache.get(cssPath);
  if (hit) return hit;
  const pkg = cssPath.split("/").slice(0, 2).join("/");
  const raw = await readFile(path.join(nodeModules(), cssPath), "utf8");
  const blocks = raw.split(/(?=\/\*)/).filter((b) => /\/\*[^*]*-latin-/.test(b) && !/-latin-ext-/.test(b));
  const css = (blocks.length ? blocks : [raw])
    .join("\n")
    .replace(/url\(\.\/files\/([^)]+)\)/g, (_m, file) => `url(__BASE__fonts/${pkg}/files/${file})`)
    // Sin respaldo .woff: Chromium siempre carga woff2.
    .replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/g, "");
  cache.set(cssPath, css);
  return css;
}

export async function fontFaceCss(ids: FontId[], base: string): Promise<string> {
  const unique = Array.from(new Set(ids));
  const parts = await Promise.all(unique.flatMap((id) => FONTS[id].css.map(sheet)));
  return parts.join("\n").replaceAll("__BASE__", base);
}

export const ALL_FONTS = Object.keys(FONTS) as FontId[];

/** Solo se sirven archivos de fuentes de los paquetes @fontsource. */
export function fontFilePath(rel: string): string | null {
  const clean = path.posix.normalize(rel);
  if (!/^@fontsource(-variable)?\/[a-z0-9-]+\/files\/[a-z0-9-]+\.woff2$/.test(clean)) return null;
  return path.join(nodeModules(), clean);
}
