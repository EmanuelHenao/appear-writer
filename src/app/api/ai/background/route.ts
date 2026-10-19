import { z } from "zod";
import { generateImage } from "@/lib/ai/client";
import { errorResponse, fail, NO_AI } from "@/lib/http";
import { getAiConfig } from "@/lib/settings";
import { dataPath, newId, writeBinary } from "@/lib/storage";

const Body = z.object({
  text: z.string().min(1).max(2000),
  idea: z.string().max(300).optional(),
  square: z.boolean().default(false),
});

/** Genera un fondo sin texto para poner la frase encima. */
export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const cfg = await getAiConfig();
    if (!cfg) return fail(NO_AI);
    const prompt =
      `Fondo fotográfico o artístico para una publicación de Instagram, sin ningún texto, letras ni logotipos. ` +
      `Composición con espacio limpio en el centro para colocar texto encima. ` +
      (body.idea ? `Idea visual: ${body.idea}. ` : `Debe evocar el sentimiento de esta frase: «${body.text}». `) +
      `Estilo natural, cálido y realista; que no parezca generado por ordenador.`;
    const png = await generateImage(cfg, prompt, body.square ? "1024x1024" : "1024x1536");
    const id = newId();
    await writeBinary(dataPath("uploads", "ia", `${id}.png`), png);
    return Response.json({ url: `/api/files/uploads/ia/${id}.png`, source: "ia", credit: "Generado con IA" });
  } catch (e) {
    return errorResponse(e);
  }
}
