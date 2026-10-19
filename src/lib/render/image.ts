import "server-only";
import { createElement } from "react";
import { autofitAll } from "@/design/autofit";
import type { SlideSpec } from "@/design/spec";
import { Slide } from "@/design/templates";
import { openDoc, toVirtual, VIRTUAL_ORIGIN } from "./browser";
import { ALL_FONTS, fontFaceCss } from "./fontcss";

async function markup(slides: SlideSpec[]): Promise<string> {
  // react-dom/server se carga bajo demanda: solo hace falta al exportar.
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup(
    createElement(
      "div",
      { id: "slides" },
      slides.map((s, i) =>
        createElement(
          "div",
          { key: i, className: "slide", style: { width: s.width, height: s.height } },
          createElement(Slide, { spec: s }),
        ),
      ),
    ),
  );
}

/** Dibuja cada diapositiva con Chromium y devuelve un PNG por diapositiva. */
export async function renderSlidesPng(input: SlideSpec[], hiRes: boolean): Promise<Buffer[]> {
  if (!input.length) return [];
  const slides = input.map((s) => ({
    ...s,
    photo: s.photo ? { ...s.photo, url: toVirtual(s.photo.url)! } : s.photo,
    brand: { ...s.brand, logoUrl: toVirtual(s.brand.logoUrl) },
  }));
  const css = await fontFaceCss(ALL_FONTS, VIRTUAL_ORIGIN);
  const body = await markup(slides);
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}
html,body{margin:0;padding:0;background:#ffffff}
#slides{display:flex;flex-direction:column;align-items:flex-start}
.slide{flex:none;overflow:hidden}
</style></head><body>${body}</body></html>`;
  const { page, context } = await openDoc({ html, width: slides[0].width, height: slides[0].height, scale: hiRes ? 2 : 1 });
  try {
    await page.evaluate(() => Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => undefined))));
    await page.evaluate(`(${autofitAll.toString()})(document)`);
    const handles = await page.$$(".slide");
    const out: Buffer[] = [];
    for (const h of handles) out.push(await h.screenshot({ type: "png" }));
    return out;
  } finally {
    await context.close();
  }
}
