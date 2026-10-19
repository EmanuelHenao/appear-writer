import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getBook } from "@/book/project";
import { bookHtml } from "@/book/service";
import { renderBookPngs } from "@/lib/render/book";
import { dataPath, exists, writeBinary } from "@/lib/storage";

/** Miniatura de la portada, siempre al día con las opciones actuales. */
export async function GET(_req: Request, ctx: RouteContext<"/api/books/[id]/cover">) {
  const { id } = await ctx.params;
  const book = await getBook(id);
  if (!book) return new Response("No existe ese libro.", { status: 404 });
  const o = book.options;
  const key = createHash("sha1")
    .update(JSON.stringify({ c: o.cover, p: o.palette, f: o.font, s: o.pageSize, b: o.bleed }))
    .digest("hex")
    .slice(0, 12);
  const file = dataPath("books", id, `cover-${key}.png`);
  if (!(await exists(file))) {
    const [png] = await renderBookPngs(await bookHtml(book, "print", 0, true), o, { scale: 1, only: 1 });
    await writeBinary(file, png);
  }
  return new Response(new Uint8Array(await readFile(file)), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
