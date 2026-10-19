import { getBook } from "@/book/project";
import { bookHtml } from "@/book/service";

/** Documento HTML del libro para el iframe de vista previa. */
export async function GET(req: Request, ctx: RouteContext<"/api/books/[id]/preview">) {
  const { id } = await ctx.params;
  const book = await getBook(id);
  if (!book) return new Response("No existe ese libro.", { status: 404 });
  const params = new URL(req.url).searchParams;
  const limit = Number(params.get("limite") ?? "40") || 40;
  const focus = params.get("foco")?.slice(0, 200) || undefined;
  const html = await bookHtml(book, "preview", Math.min(Math.max(limit, 4), 400), false, focus);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
