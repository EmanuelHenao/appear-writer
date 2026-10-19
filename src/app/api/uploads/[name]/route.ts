import { errorResponse, fail } from "@/lib/http";
import { isUploadName, removeUpload } from "@/lib/uploads";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/uploads/[name]">) {
  try {
    const { name } = await ctx.params;
    if (!isUploadName(name)) return fail("Nombre de foto no válido.");
    await removeUpload(name);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
