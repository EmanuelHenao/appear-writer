import "server-only";
import type { FontId } from "@/design/fonts";
import { toVirtual, VIRTUAL_ORIGIN } from "@/lib/render/browser";
import { renderBookPdf, renderBookPngs } from "@/lib/render/book";
import { fontFaceCss } from "@/lib/render/fontcss";
import { dataPath, writeBinary } from "@/lib/storage";
import { buildEpub } from "./epub";
import { buildBookHtml } from "./html";
import { saveBook, type BookProject } from "./project";
import { buildChapters } from "./structure";

const FONTS_FOR = (font: string): FontId[] => [font as FontId, "fraunces", "jost"];

export async function bookHtml(book: BookProject, target: "preview" | "print", previewLimit = 0, coverOnly = false): Promise<string> {
  const chapters = coverOnly ? [] : buildChapters(book.sources, book.options, book.ai);
  const base = target === "print" ? VIRTUAL_ORIGIN : "/api/";
  const fontCss = await fontFaceCss(FONTS_FOR(book.options.font), base);
  const mediaUrl =
    target === "print"
      ? (f: string) => `${VIRTUAL_ORIGIN}data/books/${book.id}/media/${encodeURIComponent(f)}`
      : (f: string) => `/api/files/books/${book.id}/media/${encodeURIComponent(f)}`;
  return buildBookHtml({
    chapters,
    options: book.options,
    fontCss,
    mediaUrl,
    // Las fotos subidas viven en DATA_DIR: Chromium las lee del origen virtual.
    stock: book.options.content.stockPhotos ? book.stock.photos.map((p) => (target === "print" ? { ...p, url: toVirtual(p.url)! } : p)) : [],
    previewLimit,
  });
}

/** Renderiza la portada y la guarda para la galería y el EPUB. */
export async function renderCover(book: BookProject): Promise<Buffer> {
  const html = await bookHtml(book, "print", 0, true);
  const [png] = await renderBookPngs(html, book.options, { scale: 2, only: 1 });
  await writeBinary(dataPath("books", book.id, "cover.png"), png);
  book.hasCover = true;
  return png;
}

export async function exportPdf(book: BookProject) {
  const { pdf, pages } = await renderBookPdf(await bookHtml(book, "print"), book.options);
  book.lastPages = pages;
  await renderCover(book).catch(() => undefined);
  await saveBook(book);
  return pdf;
}

export async function exportPngs(book: BookProject) {
  return renderBookPngs(await bookHtml(book, "print"), book.options, { scale: 2 });
}

export async function exportEpub(book: BookProject) {
  const cover = await renderCover(book);
  await saveBook(book);
  return buildEpub({ bookId: book.id, chapters: buildChapters(book.sources, book.options, book.ai), options: book.options, coverPng: cover });
}
