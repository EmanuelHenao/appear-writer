import "server-only";
import type { PhotoRef } from "@/design/spec";

// Fotos reales de bancos de imágenes. Se pide orientación vertical porque
// casi todos los formatos de redes son verticales.

export interface PhotoResult extends PhotoRef {
  id: string;
  /** Unsplash pide avisar cuando se usa una foto. */
  downloadLocation?: string;
}

export async function searchUnsplash(key: string, q: string, orientation: "portrait" | "squarish" | "landscape"): Promise<PhotoResult[]> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=18&orientation=${orientation}&content_filter=high`;
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" } });
  if (res.status === 401) throw new Error("La key de Unsplash no es válida.");
  if (!res.ok) throw new Error(`Unsplash respondió ${res.status}.`);
  const data = await res.json();
  type U = {
    id: string;
    urls: { regular: string; small: string; full: string };
    user: { name: string; links: { html: string } };
    links: { download_location: string };
  };
  return (data.results as U[]).map((r) => ({
    id: `u-${r.id}`,
    url: r.urls.full + "&w=2160&q=85&fm=jpg",
    thumb: r.urls.small,
    credit: `${r.user.name} en Unsplash`,
    creditUrl: `${r.user.links.html}?utm_source=appear_writer&utm_medium=referral`,
    source: "unsplash" as const,
    downloadLocation: r.links.download_location,
  }));
}

export async function searchPexels(key: string, q: string, orientation: "portrait" | "square" | "landscape"): Promise<PhotoResult[]> {
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=18&orientation=${orientation}`;
  const res = await fetch(url, { headers: { Authorization: key } });
  if (res.status === 401) throw new Error("La key de Pexels no es válida.");
  if (!res.ok) throw new Error(`Pexels respondió ${res.status}.`);
  const data = await res.json();
  type P = { id: number; src: { large2x: string; medium: string; original: string }; photographer: string; photographer_url: string };
  return (data.photos as P[]).map((p) => ({
    id: `p-${p.id}`,
    url: p.src.large2x,
    thumb: p.src.medium,
    credit: `${p.photographer} en Pexels`,
    creditUrl: p.photographer_url,
    source: "pexels" as const,
  }));
}

/** Busca en los bancos configurados y mezcla los resultados. */
export async function searchPhotos(
  keys: { unsplash: string; pexels: string },
  q: string,
  shape: "vertical" | "cuadrada" | "horizontal" = "vertical",
): Promise<{ results: PhotoResult[]; errors: string[] }> {
  const tasks: Promise<PhotoResult[]>[] = [];
  if (keys.unsplash) tasks.push(searchUnsplash(keys.unsplash, q, shape === "vertical" ? "portrait" : shape === "cuadrada" ? "squarish" : "landscape"));
  if (keys.pexels) tasks.push(searchPexels(keys.pexels, q, shape === "vertical" ? "portrait" : shape === "cuadrada" ? "square" : "landscape"));
  const settled = await Promise.allSettled(tasks);
  const lists = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const errors = settled.flatMap((s) => (s.status === "rejected" ? [String((s.reason as Error)?.message ?? s.reason)] : []));
  const results: PhotoResult[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < max; i++) for (const l of lists) if (l[i]) results.push(l[i]);
  return { results, errors };
}

export async function trackUnsplash(key: string, downloadLocation: string) {
  if (!key || !downloadLocation.startsWith("https://api.unsplash.com/")) return;
  await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => undefined);
}
