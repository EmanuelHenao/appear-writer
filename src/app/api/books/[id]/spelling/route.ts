import { getBook } from "@/book/project";
import { errorResponse, fail } from "@/lib/http";
import { checkSpelling } from "@/lib/spelling";

/** Revisa la ortografía del libro sin IA. Solo propone: no cambia nada. */
export async function POST(_req: Request, ctx: RouteContext<"/api/books/[id]/spelling">) {
  try {
    const { id } = await ctx.params;
    const book = await getBook(id);
    if (!book) return fail("No existe ese libro.", 404);
    const texts: string[] = [];
    const names = new Set<string>();
    for (const s of book.sources) {
      names.add(s.name);
      s.meta.participants?.forEach((p) => names.add(p));
      for (const b of s.blocks) {
        if (b.type === "paragraph" || b.type === "message") texts.push(b.text);
        if (b.type === "message") names.add(b.author);
      }
    }
    return Response.json({ issues: await checkSpelling(texts, [...names]) });
  } catch (e) {
    return errorResponse(e);
  }
}
