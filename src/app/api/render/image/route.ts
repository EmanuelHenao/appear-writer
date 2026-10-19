import { ImageRequestSchema } from "@/design/request";
import { renderRequest, saveToGallery } from "@/lib/gallery";
import { errorResponse } from "@/lib/http";
import { attachment, slugify, zipFiles } from "@/lib/zip";

export const maxDuration = 120;

/** Exporta la imagen: un PNG o, si es carrusel, un ZIP con todas. */
export async function POST(req: Request) {
  try {
    const body = ImageRequestSchema.parse(await req.json());
    const { pngs, width, height } = await renderRequest(body);
    const headers = new Headers();
    if (body.options.extras.gallery) {
      const item = await saveToGallery(body, pngs, { width, height });
      headers.set("X-Gallery-Id", item.id);
    }
    const base = slugify(body.text);
    if (pngs.length === 1) {
      headers.set("Content-Type", "image/png");
      headers.set("Content-Disposition", attachment(`${base}.png`));
      return new Response(new Uint8Array(pngs[0]), { headers });
    }
    const files = pngs.map((data, i) => ({ name: `${base}-${String(i + 1).padStart(2, "0")}.png`, data }));
    if (body.caption) {
      files.push({ name: "texto.txt", data: Buffer.from(`${body.caption.texto}\n\n${body.caption.hashtags.join(" ")}\n`) });
    }
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", attachment(`${base}-carrusel.zip`));
    return new Response(new Uint8Array(await zipFiles(files)), { headers });
  } catch (e) {
    return errorResponse(e);
  }
}
