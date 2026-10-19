import { z } from "zod";
import { BookEditsSchema } from "@/book/edits";
import { BookOptionsSchema } from "@/book/options";
import { deleteBook, getBook, refreshSuggestions, saveBook } from "@/book/project";
import { errorResponse, fail } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/books/[id]">) {
  const { id } = await ctx.params;
  const book = await getBook(id);
  return book ? Response.json(book) : fail("No existe ese libro.", 404);
}

const Patch = z.object({
  options: BookOptionsSchema.optional(),
  /** Vuelve a los valores sugeridos. */
  resetOptions: z.boolean().optional(),
  order: z.array(z.string()).optional(),
  removeSource: z.string().optional(),
  renameSource: z.object({ id: z.string(), name: z.string().min(1).max(120) }).optional(),
  stock: z
    .object({
      query: z.string().max(120),
      photos: z.array(z.object({ url: z.string(), thumb: z.string().optional(), credit: z.string().optional(), creditUrl: z.string().optional(), source: z.enum(["unsplash", "pexels", "ia", "subida"]).optional() })).max(40),
    })
    .optional(),
  clearAi: z.enum(["chapters", "spelling", "all"]).optional(),
  edits: BookEditsSchema.optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/books/[id]">) {
  try {
    const { id } = await ctx.params;
    const book = await getBook(id);
    if (!book) return fail("No existe ese libro.", 404);
    const p = Patch.parse(await req.json());
    if (p.options) {
      book.options = p.options;
      book.optionsTouched = true;
    }
    if (p.resetOptions) {
      book.optionsTouched = false;
      refreshSuggestions(book);
    }
    if (p.order) {
      const byId = new Map(book.sources.map((s) => [s.id, s]));
      const ordered = p.order.map((i) => byId.get(i)).filter((s): s is NonNullable<typeof s> => !!s);
      book.sources = [...ordered, ...book.sources.filter((s) => !p.order!.includes(s.id))];
    }
    if (p.removeSource) {
      book.sources = book.sources.filter((s) => s.id !== p.removeSource);
      refreshSuggestions(book);
    }
    if (p.renameSource) {
      const s = book.sources.find((x) => x.id === p.renameSource!.id);
      if (s) s.name = p.renameSource.name;
    }
    if (p.stock) book.stock = p.stock;
    if (p.edits) book.edits = p.edits;
    if (p.clearAi === "chapters" || p.clearAi === "all") {
      delete book.ai.chapterTitles;
      delete book.ai.breaks;
    }
    if (p.clearAi === "spelling" || p.clearAi === "all") delete book.ai.corrections;
    await saveBook(book);
    return Response.json(book);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/books/[id]">) {
  const { id } = await ctx.params;
  return (await deleteBook(id)) ? Response.json({ ok: true }) : fail("No existe ese libro.", 404);
}
