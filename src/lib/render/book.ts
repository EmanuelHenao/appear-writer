import "server-only";
import { pageGeometry } from "@/book/html";
import type { BookOptions } from "@/book/options";
import { openDoc } from "./browser";

const MM_TO_PX = 96 / 25.4;

async function open(html: string, options: BookOptions, scale: number) {
  const g = pageGeometry(options);
  const width = Math.ceil(g.w * MM_TO_PX);
  const height = Math.ceil(g.h * MM_TO_PX);
  // Un libro de miles de páginas tarda: se da margen de sobra.
  return openDoc({ html, width, height, scale, media: "print", readySelector: "body[data-ready]", timeoutMs: 600_000 });
}

export async function renderBookPdf(html: string, options: BookOptions): Promise<{ pdf: Buffer; pages: number }> {
  const g = pageGeometry(options);
  const { page, context } = await open(html, options, 1);
  page.setDefaultTimeout(600_000);
  try {
    const pages = await page.evaluate(() => (window as unknown as { __BOOK_READY__: { pages: number } }).__BOOK_READY__.pages);
    const pdf = await page.pdf({
      width: `${g.w}mm`,
      height: `${g.h}mm`,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      tagged: true,
      outline: false,
    });
    return { pdf: Buffer.from(pdf), pages };
  } finally {
    await context.close();
  }
}

/** Un PNG por página. `only` limita a las primeras páginas (portada: 1). */
export async function renderBookPngs(html: string, options: BookOptions, opts: { scale?: number; only?: number } = {}): Promise<Buffer[]> {
  const { page, context } = await open(html, options, opts.scale ?? 2);
  try {
    const handles = await page.$$("#book > .page");
    const list = opts.only ? handles.slice(0, opts.only) : handles;
    const out: Buffer[] = [];
    for (const h of list) out.push(await h.screenshot({ type: "png", timeout: 60_000 }));
    return out;
  } finally {
    await context.close();
  }
}
