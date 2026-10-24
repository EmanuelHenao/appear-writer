import "server-only";
import type { Page } from "playwright";
import { PDFDocument, PDFName, PDFPageTree, type PDFRef } from "pdf-lib";
import { pageGeometry } from "@/book/html";
import type { BookOptions } from "@/book/options";
import { openDoc } from "./browser";

const MM_TO_PX = 96 / 25.4;

/** Hasta aquí el PDF sale de una pasada (y etiquetado); más allá, por tandas. */
const PDF_CHUNK = 250;

async function open(html: string, options: BookOptions, scale: number) {
  const g = pageGeometry(options);
  const width = Math.ceil(g.w * MM_TO_PX);
  const height = Math.ceil(g.h * MM_TO_PX);
  // Un libro de miles de páginas tarda: se da margen de sobra.
  const doc = await openDoc({ html, width, height, scale, media: "print", readySelector: "body[data-ready]", timeoutMs: 1_800_000 });
  doc.page.setDefaultTimeout(1_800_000);
  return doc;
}

/**
 * Deja en el documento solo las páginas [a, b); las demás salen de él (no
 * basta con ocultarlas: Chromium sigue pagando por ellas al imprimir o
 * capturar). Así cada tanda cuesta lo mismo, sea cual sea el tamaño del libro.
 */
async function showRange(page: Page, a: number, b: number) {
  await page.evaluate(
    ([a, b]) => {
      const w = window as unknown as { __pages?: HTMLElement[]; __shown?: [number, number] };
      const book = document.getElementById("book")!;
      if (!w.__pages) {
        w.__pages = Array.from(book.querySelectorAll<HTMLElement>(":scope > .page"));
        book.replaceChildren();
        w.__shown = [0, 0];
      }
      const [pa, pb] = w.__shown!;
      for (let i = pa; i < pb; i++) w.__pages[i].remove();
      const frag = document.createDocumentFragment();
      for (let i = a; i < b; i++) frag.appendChild(w.__pages[i]);
      book.appendChild(frag);
      w.__shown = [a, b];
    },
    [a, b] as [number, number],
  );
}

export async function renderBookPdf(html: string, options: BookOptions): Promise<{ pdf: Buffer; pages: number }> {
  const g = pageGeometry(options);
  const { page, context } = await open(html, options, 1);
  try {
    const pages = await page.evaluate(() => (window as unknown as { __BOOK_READY__: { pages: number } }).__BOOK_READY__.pages);
    const print = (tagged: boolean) =>
      page.pdf({
        width: `${g.w}mm`,
        height: `${g.h}mm`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
        tagged,
        outline: false,
      });
    if (pages <= PDF_CHUNK) return { pdf: Buffer.from(await print(true)), pages };

    // Chromium tarda más que lineal al imprimir miles de páginas de una vez:
    // se imprime por tandas y se unen. (Al unir se pierde el etiquetado.)
    const merged = await PDFDocument.create();
    // El árbol de páginas se arma a mano, un nodo por tanda: `addPage` de
    // pdf-lib recorre todas las páginas en cada inserción (cuadrático).
    const rootRef = merged.catalog.get(PDFName.of("Pages")) as PDFRef;
    const root = merged.catalog.Pages();
    for (let a = 0; a < pages; a += PDF_CHUNK) {
      await showRange(page, a, Math.min(pages, a + PDF_CHUNK));
      const part = await PDFDocument.load(await print(false));
      const copied = await merged.copyPages(part, part.getPageIndices());
      const node = PDFPageTree.withContext(merged.context, rootRef);
      const nodeRef = merged.context.register(node);
      root.pushTreeNode(nodeRef);
      for (const p of copied) {
        node.pushLeafNode(p.ref);
        p.node.setParent(nodeRef);
      }
    }
    return { pdf: Buffer.from(await merged.save()), pages };
  } finally {
    await context.close();
  }
}

/**
 * Un PNG por página, de una en una: se entrega cada imagen a `onPage` en
 * cuanto está, sin guardar todas en memoria. `only` limita a las primeras
 * páginas (portada: 1).
 */
export async function eachBookPng(html: string, options: BookOptions, onPage: (png: Buffer, index: number, total: number) => Promise<void> | void, opts: { scale?: number; only?: number } = {}): Promise<number> {
  const { page, context } = await open(html, options, opts.scale ?? 2);
  try {
    const all = await page.evaluate(() => (window as unknown as { __BOOK_READY__: { pages: number } }).__BOOK_READY__.pages);
    const total = opts.only ? Math.min(opts.only, all) : all;
    for (let i = 0; i < total; i++) {
      // Solo la página i está en el documento visible: arriba a la izquierda, del tamaño de la ventana.
      await showRange(page, i, i + 1);
      await onPage(await page.screenshot({ type: "png", timeout: 60_000 }), i, total);
    }
    return total;
  } finally {
    await context.close();
  }
}

export async function renderBookPngs(html: string, options: BookOptions, opts: { scale?: number; only?: number } = {}): Promise<Buffer[]> {
  const out: Buffer[] = [];
  await eachBookPng(html, options, (png) => void out.push(png), opts);
  return out;
}
