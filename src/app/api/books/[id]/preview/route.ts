import { z } from "zod";
import { getBook } from "@/book/project";
import { bookHtml, previewSegments } from "@/book/service";

/** Documento HTML del libro para el iframe de vista previa. */
export async function GET(req: Request, ctx: RouteContext<"/api/books/[id]/preview">) {
  const { id } = await ctx.params;
  const book = await getBook(id);
  if (!book) return new Response("No existe ese libro.", { status: 404 });
  const params = new URL(req.url).searchParams;
  // Solo las secciones (con su huella): la vista previa repagina las que cambiaron.
  if (params.get("formato") === "secciones") {
    return Response.json({ segments: await previewSegments(book) }, { headers: { "Cache-Control": "no-store" } });
  }
  const limit = Number(params.get("limite") ?? "40") || 40;
  const focus = params.get("foco")?.slice(0, 200) || undefined;
  const html = await bookHtml(book, "preview", Math.min(Math.max(limit, 4), 400), false, focus);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

const Have = z.object({ have: z.record(z.string(), z.string()).default({}) });

/** Las secciones del libro; las que la vista previa ya tiene (misma huella) van sin HTML. */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/preview">) {
  const { id } = await ctx.params;
  const book = await getBook(id);
  if (!book) return new Response("No existe ese libro.", { status: 404 });
  const { have } = Have.parse(await req.json().catch(() => ({})));
  const segments = (await previewSegments(book)).map((s) => (have[s.key] === s.hash ? { key: s.key, hash: s.hash } : s));
  return Response.json({ segments }, { headers: { "Cache-Control": "no-store" } });
}
