import { readFile } from "node:fs/promises";
import { dataPath, mimeFor } from "@/lib/storage";

const ALLOWED = new Set(["gallery", "brand", "books", "uploads"]);

export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path } = await ctx.params;
  if (!path.length || !ALLOWED.has(path[0]) || path.some((p) => p === ".." || p.includes("\0"))) {
    return new Response("No encontrado", { status: 404 });
  }
  try {
    const file = dataPath(...path);
    const body = await readFile(file);
    return new Response(new Uint8Array(body), {
      headers: { "Content-Type": mimeFor(file), "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
