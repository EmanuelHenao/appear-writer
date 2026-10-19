import { z } from "zod";
import { getBook, saveBook, bookSummary } from "@/book/project";
import { buildChapters, chapterExcerpt } from "@/book/structure";
import { correctSpelling, splitIntoChapters, suggestBookTitle, suggestCover, titleChapters } from "@/lib/ai/tasks";
import { errorResponse, fail, NO_AI } from "@/lib/http";
import { getAiConfig } from "@/lib/settings";

export const maxDuration = 900;

const Body = z.object({ step: z.enum(["chapters", "spelling", "title", "cover"]) });

/**
 * Ejecuta un paso de IA y guarda el resultado aparte: el texto original
 * nunca se sobrescribe y cada paso se puede quitar desmarcando su casilla.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/ai">) {
  try {
    const { id } = await ctx.params;
    const book = await getBook(id);
    if (!book) return fail("No existe ese libro.", 404);
    const cfg = await getAiConfig();
    if (!cfg) return fail(NO_AI);
    const { step } = Body.parse(await req.json());

    if (step === "title") {
      const s = await suggestBookTitle(cfg, bookSummary(book));
      book.ai.titleSuggestion = s;
      book.options.cover.title = s.titulo;
      book.options.cover.subtitle = s.subtitulo;
      book.options.ai.title = true;
    }

    if (step === "cover") {
      const c = await suggestCover(cfg, bookSummary(book));
      book.options.cover.template = c.portada;
      book.options.palette = c.paleta;
      book.ai.coverReason = c.razon;
      book.options.ai.cover = true;
    }

    if (step === "chapters") {
      // Fuentes sin títulos y largas: la IA propone dónde cortar.
      const breaks: Record<string, { inicio: number; titulo: string }[]> = {};
      for (const s of book.sources) {
        if (s.kind === "whatsapp") continue;
        if (s.blocks.some((b) => b.type === "heading" && b.level === 1)) continue;
        const paras = s.blocks.map((b) => (b.type === "paragraph" || b.type === "heading" ? b.text : ""));
        if (paras.filter(Boolean).length < 12) continue;
        breaks[s.id] = await splitIntoChapters(cfg, paras.slice(0, 600));
      }
      book.ai.breaks = breaks;
      const withBreaks = { ...book.options, ai: { ...book.options.ai, chapters: true } };
      const chapters = buildChapters(book.sources, withBreaks, { breaks });
      const titles: Record<string, string> = {};
      for (let i = 0; i < chapters.length; i += 30) {
        const slice = chapters.slice(i, i + 30);
        const out = await titleChapters(cfg, slice.map((c) => chapterExcerpt(c)));
        slice.forEach((c, j) => {
          if (out[j]?.trim()) titles[c.key] = out[j].trim();
        });
      }
      book.ai.chapterTitles = titles;
      book.options.ai.chapters = true;
    }

    if (step === "spelling") {
      const corrections: Record<string, string> = {};
      for (const s of book.sources) {
        const items = s.blocks
          .map((b, i) => ({ key: `${s.id}:${i}`, text: b.type === "paragraph" || b.type === "message" ? b.text : "" }))
          .filter((x) => x.text.trim());
        // Lotes por tamaño para no pasar el límite de salida.
        let batch: typeof items = [];
        let size = 0;
        const flush = async () => {
          if (!batch.length) return;
          const fixed = await correctSpelling(cfg, batch.map((b) => b.text));
          batch.forEach((b, j) => {
            if (fixed[j] && fixed[j] !== b.text) corrections[b.key] = fixed[j];
          });
          batch = [];
          size = 0;
        };
        for (const it of items) {
          if (size + it.text.length > 12_000 || batch.length >= 120) await flush();
          batch.push(it);
          size += it.text.length;
        }
        await flush();
      }
      book.ai.corrections = corrections;
      book.options.ai.spelling = true;
    }

    book.optionsTouched = true;
    await saveBook(book);
    return Response.json(book);
  } catch (e) {
    return errorResponse(e);
  }
}
