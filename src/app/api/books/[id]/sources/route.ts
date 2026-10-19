import { getBook, refreshSuggestions, saveBook } from "@/book/project";
import { importFile, importPasted, MAX_UPLOAD } from "@/import";
import { errorResponse, fail } from "@/lib/http";

export const maxDuration = 300;

/** Añade fuentes: archivos (campo «files») o texto pegado (campo «text»). */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/sources">) {
  try {
    const { id } = await ctx.params;
    const book = await getBook(id);
    if (!book) return fail("No existe ese libro.", 404);
    const form = await req.formData();
    const errors: string[] = [];
    let added = 0;
    for (const f of form.getAll("files")) {
      if (!(f instanceof File)) continue;
      if (f.size > MAX_UPLOAD) {
        errors.push(`«${f.name}» pasa de 200 MB.`);
        continue;
      }
      try {
        book.sources.push(await importFile(book.id, { name: f.name, data: Buffer.from(await f.arrayBuffer()) }));
        added++;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `No se pudo leer «${f.name}».`);
      }
    }
    const text = form.get("text");
    if (typeof text === "string" && text.trim()) {
      const title = form.get("title");
      book.sources.push(importPasted(text, typeof title === "string" && title.trim() ? title.trim() : undefined));
      added++;
    }
    if (!added && !errors.length) return fail("No llegó ningún archivo ni texto.");
    if (added) {
      refreshSuggestions(book);
      await saveBook(book);
    }
    return Response.json({ book, errors }, { status: added ? 200 : 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
