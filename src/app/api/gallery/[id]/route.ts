import { readFile } from "node:fs/promises";
import { deleteGalleryItem, getGalleryItem } from "@/lib/gallery";
import { fail } from "@/lib/http";
import { dataPath } from "@/lib/storage";
import { attachment, slugify, zipFiles } from "@/lib/zip";

/** Descarga lo guardado: el PNG o un ZIP si es un carrusel. */
export async function GET(req: Request, ctx: RouteContext<"/api/gallery/[id]">) {
  const { id } = await ctx.params;
  const item = await getGalleryItem(id);
  if (!item) return fail("No existe esa imagen en la galería.", 404);
  if (new URL(req.url).searchParams.has("meta")) return Response.json(item);
  const base = slugify(item.text);
  if (item.files.length === 1) {
    const png = await readFile(dataPath("gallery", id, item.files[0]));
    return new Response(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Content-Disposition": attachment(`${base}.png`) },
    });
  }
  const files = await Promise.all(
    item.files.map(async (f, i) => ({ name: `${base}-${String(i + 1).padStart(2, "0")}.png`, data: await readFile(dataPath("gallery", id, f)) })),
  );
  return new Response(new Uint8Array(await zipFiles(files)), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": attachment(`${base}-carrusel.zip`) },
  });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/gallery/[id]">) {
  const { id } = await ctx.params;
  const ok = await deleteGalleryItem(id);
  return ok ? Response.json({ ok: true }) : fail("No existe esa imagen.", 404);
}
