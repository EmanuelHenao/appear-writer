import { z } from "zod";
import { listModels, testConnection } from "@/lib/ai/client";
import { designBrief, writeCaption } from "@/lib/ai/tasks";
import { errorResponse, fail, NO_AI } from "@/lib/http";
import { getAiConfig } from "@/lib/settings";

// Tareas de IA para Imágenes y Ajustes. Todas exigen una key configurada.
const Body = z.discriminatedUnion("task", [
  z.object({ task: z.literal("test"), tier: z.enum(["main", "fast"]).default("fast") }),
  z.object({ task: z.literal("models") }),
  z.object({ task: z.literal("brief"), text: z.string().min(1).max(5000) }),
  z.object({ task: z.literal("caption"), text: z.string().min(1).max(5000) }),
]);

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());
    const cfg = await getAiConfig();
    if (!cfg) return fail(NO_AI, 400);
    switch (body.task) {
      case "test":
        await testConnection(cfg, body.tier);
        return Response.json({ ok: true, provider: cfg.provider.label, model: body.tier === "main" ? cfg.mainModel : cfg.fastModel });
      case "models":
        return Response.json({ models: await listModels(cfg) });
      case "brief":
        return Response.json(await designBrief(cfg, body.text));
      case "caption":
        return Response.json(await writeCaption(cfg, body.text));
    }
  } catch (e) {
    return errorResponse(e);
  }
}
