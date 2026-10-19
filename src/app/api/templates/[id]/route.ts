import { z } from "zod";
import { errorResponse, fail } from "@/lib/http";
import { removeTemplate, updateTemplate } from "@/lib/templates";

export async function PATCH(req: Request, ctx: RouteContext<"/api/templates/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = z.object({ name: z.string().min(1).max(60) }).parse(await req.json());
    const item = await updateTemplate(id, body);
    return item ? Response.json(item) : fail("No existe esa plantilla.", 404);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/templates/[id]">) {
  const { id } = await ctx.params;
  return (await removeTemplate(id)) ? Response.json({ ok: true }) : fail("No existe esa plantilla.", 404);
}
