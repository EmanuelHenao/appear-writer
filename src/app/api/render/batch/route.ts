import { z } from "zod";
import { buildProposals, ImageOptionsSchema } from "@/design/compose";
import { readText } from "@/design/fit";
import { renderRequest, saveToGallery } from "@/lib/gallery";
import { errorResponse, fail } from "@/lib/http";
import { attachment, slugify, zipFiles } from "@/lib/zip";

export const maxDuration = 300;

const Body = z.object({
  texts: z.array(z.string().min(1).max(5000)).min(1).max(60),
  options: ImageOptionsSchema,
  /** Si es true, cada frase usa el formato sugerido por su longitud. */
  autoFormat: z.boolean().default(true),
});

/** Genera muchas frases de una vez, alternando estilos, y devuelve un ZIP. */
export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const texts = body.texts.map((t) => t.trim()).filter(Boolean);
    if (!texts.length) return fail("No hay frases para generar.");
    const designs = buildProposals(body.options, 0, Math.max(4, texts.length));
    const files: { name: string; data: Buffer }[] = [];
    for (const [i, text] of texts.entries()) {
      const reading = readText(text);
      const options = body.autoFormat ? { ...body.options, format: reading.suggestedFormat } : body.options;
      const request = { text, options, design: designs[i], sizeScale: 1, emphasis: reading.emphasis };
      const { pngs, width, height } = await renderRequest(request);
      if (options.extras.gallery) await saveToGallery(request, pngs, { width, height });
      const base = `${String(i + 1).padStart(2, "0")}-${slugify(text, 30)}`;
      pngs.forEach((data, j) => files.push({ name: pngs.length > 1 ? `${base}-${j + 1}.png` : `${base}.png`, data }));
    }
    return new Response(new Uint8Array(await zipFiles(files)), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": attachment(`lote-${texts.length}-imagenes.zip`) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
