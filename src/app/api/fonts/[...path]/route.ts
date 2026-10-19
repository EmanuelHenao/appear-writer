import { readFile } from "node:fs/promises";
import { fontFilePath } from "@/lib/render/fontcss";

/** Archivos de fuentes para la vista previa del libro. */
export async function GET(_req: Request, ctx: RouteContext<"/api/fonts/[...path]">) {
  const { path } = await ctx.params;
  const file = fontFilePath(path.join("/"));
  if (!file) return new Response("No encontrado", { status: 404 });
  try {
    return new Response(new Uint8Array(await readFile(file)), {
      headers: { "Content-Type": "font/woff2", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
