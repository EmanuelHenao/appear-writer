import { z } from "zod";
import { getBook } from "@/book/project";
import { exportEpub, exportPdf, exportPngs } from "@/book/service";
import { errorResponse, fail } from "@/lib/http";
import { attachment, slugify, zipFiles } from "@/lib/zip";

export const maxDuration = 900;

const Body = z.object({ format: z.enum(["pdf", "epub", "png"]) });

export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/export">) {
  try {
    const { id } = await ctx.params;
    const book = await getBook(id);
    if (!book) return fail("No existe ese libro.", 404);
    if (!book.sources.length) return fail("Añade al menos una fuente antes de generar el libro.");
    const { format } = Body.parse(await req.json());
    const name = slugify(book.options.cover.title || "libro", 50);
    if (format === "pdf") {
      const pdf = await exportPdf(book);
      return new Response(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": attachment(`${name}.pdf`), "X-Pages": String(book.lastPages ?? 0) },
      });
    }
    if (format === "epub") {
      const epub = await exportEpub(book);
      return new Response(new Uint8Array(epub), { headers: { "Content-Type": "application/epub+zip", "Content-Disposition": attachment(`${name}.epub`) } });
    }
    const pngs = await exportPngs(book);
    const zip = await zipFiles(pngs.map((data, i) => ({ name: `${name}-${String(i + 1).padStart(4, "0")}.png`, data })));
    return new Response(new Uint8Array(zip), {
      headers: { "Content-Type": "application/zip", "Content-Disposition": attachment(`${name}-paginas.zip`), "X-Pages": String(pngs.length) },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
