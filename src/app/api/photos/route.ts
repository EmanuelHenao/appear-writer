import { z } from "zod";
import { errorResponse, fail } from "@/lib/http";
import { searchPhotos, trackUnsplash } from "@/lib/photos";
import { loadSettings, photoKeys } from "@/lib/settings";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const shape = (url.searchParams.get("forma") ?? "vertical") as "vertical" | "cuadrada" | "horizontal";
    if (!q) return fail("Escribe qué foto buscas.");
    const keys = photoKeys(await loadSettings());
    if (!keys.unsplash && !keys.pexels) {
      return fail("Para usar fotos reales añade una key de Unsplash o de Pexels en Ajustes.", 400);
    }
    const { results, errors } = await searchPhotos(keys, q, shape);
    if (!results.length && errors.length) return fail(errors.join(" "), 502);
    return Response.json({ results, errors });
  } catch (e) {
    return errorResponse(e);
  }
}

const Track = z.object({ downloadLocation: z.string() });

/** Unsplash pide registrar cada uso de una foto. */
export async function POST(req: Request) {
  try {
    const { downloadLocation } = Track.parse(await req.json());
    await trackUnsplash(photoKeys(await loadSettings()).unsplash, downloadLocation);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
