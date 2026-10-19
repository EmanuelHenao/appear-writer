import { fontStack, type FontId } from "@/design/fonts";
import type { PhotoRef } from "@/design/spec";
import { coverHtml, esc } from "./covers";
import { BLEED_MM, bookPalette, PAGE_SIZES, type BookOptions } from "./options";
import { PAGINATE_JS } from "./paginate.js";
import { formatDate, type Chapter, type KeyedBlock } from "./structure";

// Documento HTML del libro: una sola fuente para la vista previa, el PDF y
// los PNG por página. El paginador arma las páginas dentro del navegador.

export interface BookDocInput {
  chapters: Chapter[];
  options: BookOptions;
  fontCss: string;
  mediaUrl: (file: string) => string;
  /** Fotos reales para las aperturas de capítulo, en orden. */
  stock?: PhotoRef[];
  /** Solo para la vista previa: páginas a mostrar. */
  previewLimit?: number;
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function roman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN) while (n >= v) {
    out += s;
    n -= v;
  }
  return out;
}

export function pageGeometry(options: BookOptions) {
  const size = PAGE_SIZES[options.pageSize];
  const bleed = options.bleed ? BLEED_MM : 0;
  const k = size.w / 148;
  return {
    trimW: size.w,
    trimH: size.h,
    bleed,
    w: size.w + bleed * 2,
    h: size.h + bleed * 2,
    margin: { top: 17 * k + bleed, bottom: 15 * k + bleed, inner: 19 * k + bleed, outer: 15 * k + bleed },
  };
}

const BODY_PT = { pequena: 10, normal: 11, grande: 12.5 } as const;

function metaLine(b: Extract<KeyedBlock, { type: "message" }>, o: BookOptions): string {
  const parts: string[] = [];
  if (o.content.showName && b.author) parts.push(b.author);
  if (b.date && o.content.showDate) parts.push(formatDate(b.date, o.content.showTime));
  else if (b.date && o.content.showTime) parts.push(b.date.slice(11, 16));
  return parts.map(esc).join(" · ");
}

function messageImages(b: Extract<KeyedBlock, { type: "message" }>, input: BookDocInput): string {
  if (!input.options.content.chatPhotos || !b.media.length) return "";
  return `<div class="msg-photos">${b.media.map((m) => `<figure class="polaroid"><img src="${esc(input.mediaUrl(m))}" alt=""></figure>`).join("")}</div>`;
}

function blockHtml(b: KeyedBlock, input: BookDocInput, first: boolean): string {
  const o = input.options;
  switch (b.type) {
    case "heading":
      return `<h3 class="sub">${esc(b.text)}</h3>`;
    case "image":
      return `<figure class="figure"><img src="${esc(input.mediaUrl(b.src))}" alt="">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
    case "paragraph": {
      const verse = b.text.includes("\n");
      return `<p class="para${verse ? " verse" : ""}${first && !verse ? " first" : ""}" data-split>${esc(b.text)}</p>`;
    }
    case "message": {
      const meta = metaLine(b, o);
      const text = b.text ? `<p class="msg-text" data-split>${esc(b.text)}</p>` : "";
      const metaHtml = meta ? `<p class="meta" data-meta-end>${meta}</p>` : "";
      if (o.content.onePerPage) {
        return `<div class="msg-own" data-mode="own" data-page-class="msg-page" data-long-class="msg msg-long">${messageImages(b, input)}${text}${metaHtml}</div>`;
      }
      return `<div class="msg">${messageImages(b, input)}${text}${metaHtml}</div>`;
    }
  }
}

function ornament(o: BookOptions, glyph: string) {
  return o.content.ornaments
    ? `<div class="orn"><span class="rule"></span><span class="glyph">${glyph}</span><span class="rule"></span></div>`
    : `<div class="orn"><span class="rule wide"></span></div>`;
}

function chapterOpener(c: Chapter, i: number, total: number, input: BookDocInput, own: boolean): string {
  const o = input.options;
  const photo = o.content.stockPhotos && input.stock?.length ? input.stock[i % input.stock.length] : null;
  const eyebrow = total > 1 ? `<div class="ch-eyebrow">Capítulo ${roman(i + 1)}</div>` : "";
  const inner = `${photo ? `<figure class="ch-photo"><img src="${esc(photo.url)}" alt=""></figure>` : ""}
    <div class="ch-head">${eyebrow}<h2 class="ch-title">${esc(c.title)}</h2>${ornament(o, "❧")}${c.subtitle ? `<div class="ch-sub">${esc(c.subtitle)}</div>` : ""}</div>
    ${photo?.credit ? `<div class="credit">Foto: ${esc(photo.credit)}</div>` : ""}`;
  const attrs = `data-chapter="${esc(c.title)}" data-chapter-key="${esc(c.key)}"`;
  return own
    ? `<div class="chapter-own" data-mode="own" data-page-class="chapter-page nohead" ${attrs}>${inner}</div>`
    : `<div class="chapter-flow" data-newpage="1" data-page-class="text chapter-start nohead" ${attrs}>${inner}</div>`;
}

export function buildBookHtml(input: BookDocInput): string {
  const o = input.options;
  const p = bookPalette(o.palette);
  const g = pageGeometry(o);
  const serif = fontStack(o.font as FontId);
  const pt = BODY_PT[o.fontScale] * (o.pageSize === "cuadrado" ? 1.08 : 1);
  const chapters = input.chapters.filter((c) => c.blocks.length);
  const items: string[] = [];

  items.push(`<div data-mode="own" data-page-class="cover nofolio nohead">${coverHtml(o, p, serif)}</div>`);
  if (o.content.titlePage) {
    items.push(`<div class="title-own" data-mode="own" data-page-class="title-page nofolio nohead">
      <div class="tp-title">${esc(o.cover.title || "Sin título")}</div>
      ${o.cover.subtitle ? `<div class="tp-sub">${esc(o.cover.subtitle)}</div>` : ""}
      ${ornament(o, "❦")}
      ${o.cover.author ? `<div class="tp-author">${esc(o.cover.author)}</div>` : ""}
    </div>`);
  }
  if (o.content.dedication.trim()) {
    items.push(`<div class="dedication" data-mode="own" data-page-class="dedication-page nofolio nohead"><p>${esc(o.content.dedication.trim())}</p></div>`);
  }
  if (o.content.toc && chapters.length > 1) {
    items.push(`<h2 class="toc-title" data-newpage="1" data-page-class="text toc-page nohead">Índice</h2>`);
    chapters.forEach((c, i) => {
      items.push(
        `<div class="toc-entry" data-toc="${esc(c.key)}"><span class="toc-n">${roman(i + 1)}</span><span class="toc-t">${esc(c.title)}</span><span class="toc-dots"></span><span class="pn"></span></div>`,
      );
    });
  }

  chapters.forEach((c, i) => {
    const isChat = c.blocks.some((b) => b.type === "message");
    const own = (isChat && o.content.onePerPage) || (o.content.stockPhotos && !!input.stock?.length);
    items.push(chapterOpener(c, i, chapters.length, input, own));
    let first = !own;
    for (const b of c.blocks) {
      items.push(blockHtml(b, input, first));
      if (b.type === "paragraph") first = false;
    }
  });

  const m = g.margin;
  const css = `
${input.fontCss}
@page { size: ${g.w}mm ${g.h}mm; margin: 0; }
:root { --pw: ${g.w}mm; --ph: ${g.h}mm; --u: calc(${g.w}mm / 420); --cover-inset: calc(var(--u) * 28 + ${g.bleed}mm);
  --paper: ${p.paper}; --ink: ${p.ink}; --muted: ${p.muted}; --accent: ${p.accent}; --deep: ${p.deep}; --soft: ${p.soft}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: ${serif}; color: var(--ink); font-size: ${pt}pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#flow { position: absolute; left: -99999px; top: 0; width: var(--pw); }
.page { width: var(--pw); height: var(--ph); position: relative; overflow: hidden; background: var(--paper); break-after: page; page-break-after: always; }
.page .inner { position: absolute; inset: 0; padding: ${m.top}mm ${m.outer}mm ${m.bottom}mm ${m.inner}mm; display: flex; flex-direction: column; }
.page.verso .inner { padding-left: ${m.outer}mm; padding-right: ${m.inner}mm; }
.head { height: 7mm; flex: none; display: flex; justify-content: space-between; gap: 6mm; font-size: 6.5pt; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); white-space: nowrap; overflow: hidden; }
.head span { overflow: hidden; text-overflow: ellipsis; }
.body { flex: 1; min-height: 0; overflow: hidden; position: relative; }
.folio { height: 6mm; flex: none; display: flex; align-items: flex-end; justify-content: center; font-size: 7.5pt; color: var(--muted); }
.page.nohead .head span { visibility: hidden; }
.page.cover .inner { padding: 0; }
.page.cover .head, .page.cover .folio { display: none; }
.cover-art { position: absolute; inset: 0; overflow: hidden; }
.page.cover .body > div { position: absolute; inset: 0; }

/* Páginas propias: centradas */
.page.title-page .body, .page.dedication-page .body, .page.msg-page .body, .page.chapter-page .body { display: flex; flex-direction: column; justify-content: center; }
.title-own { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 4mm; }
.tp-title { font-size: 2.3em; font-weight: 600; line-height: 1.05; text-wrap: balance; }
.tp-sub { font-style: italic; font-size: 1.15em; color: var(--muted); }
.tp-author { font-size: 0.85em; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); }
.dedication { text-align: center; font-style: italic; font-size: 1.15em; padding: 0 8mm; white-space: pre-line; }

.orn { display: flex; align-items: center; justify-content: center; gap: 3mm; color: var(--accent); margin: 2mm 0; }
.orn .rule { width: 12mm; height: 0.25mm; background: var(--accent); }
.orn .rule.wide { width: 22mm; }
.orn .glyph { font-size: 1.3em; line-height: 1; }

.chapter-own, .chapter-flow { display: flex; flex-direction: column; align-items: center; text-align: center; }
.chapter-flow { padding-top: 14mm; margin-bottom: 9mm; }
.ch-eyebrow { font-size: 0.72em; letter-spacing: 0.4em; text-transform: uppercase; color: var(--muted); margin-bottom: 2mm; }
.ch-title { font-size: 2.15em; font-weight: 500; line-height: 1.08; margin: 0; text-wrap: balance; }
.ch-sub { font-style: italic; font-size: 0.95em; color: var(--muted); margin-top: 1mm; }
.ch-photo { margin: 0 0 7mm; width: 100%; height: 42%; min-height: 40mm; overflow: hidden; }
.chapter-own .ch-photo { height: 48mm; }
.ch-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.credit { font-size: 6pt; color: var(--muted); margin-top: 6mm; }

.para { margin: 0; text-align: justify; hyphens: auto; white-space: pre-line; }
.para + .para { text-indent: 1.4em; }
.para.cont { text-indent: 0; }
.para.split-head { text-align-last: justify; }
.para.verse { text-align: left; text-indent: 0; margin: 0 0 0.9em; padding-left: 4mm; }
.para.first::first-letter { float: left; font-size: 3.6em; line-height: 0.82; padding: 0.06em 0.08em 0 0; color: var(--deep); font-weight: 600; }
.para.first.cont::first-letter { float: none; font-size: inherit; padding: 0; color: inherit; font-weight: inherit; }
.sub { font-size: 1.1em; font-weight: 600; margin: 1.1em 0 0.5em; }
.figure { margin: 4mm 0; text-align: center; }
.figure img { max-width: 100%; max-height: 110mm; object-fit: contain; }
.figure figcaption { font-size: 0.8em; color: var(--muted); font-style: italic; }

.msg { margin: 0 0 1.1em; }
.msg-text { margin: 0; white-space: pre-line; }
.meta { margin: 0.4em 0 0; font-size: 0.62em; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
.msg-own { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 5mm; padding: 0 3mm; }
.msg-own .msg-text { font-size: 1.6em; line-height: 1.4; text-wrap: pretty; }
.msg-own .meta { margin: 0; }
.msg-photos { display: flex; flex-wrap: wrap; justify-content: center; gap: 4mm; }
.polaroid { margin: 0; background: #fff; padding: 2.4mm 2.4mm 7mm; box-shadow: 0 1mm 3mm rgba(60,45,20,0.18); transform: rotate(-1.5deg); }
.polaroid:nth-child(2n) { transform: rotate(1.5deg); }
.polaroid img { display: block; max-width: 70mm; max-height: 62mm; object-fit: cover; }
.msg .polaroid img { max-height: 50mm; }
.msg-long .msg-text { font-size: 1.15em; }

.toc-title { font-size: 1.6em; font-weight: 500; text-align: center; margin: 10mm 0 8mm; }
.toc-entry { display: flex; align-items: baseline; gap: 2.5mm; margin: 0 0 2.2mm; }
.toc-n { width: 9mm; color: var(--muted); font-size: 0.8em; flex: none; }
.toc-t { flex: none; max-width: 78%; }
.toc-dots { flex: 1; border-bottom: 0.25mm dotted var(--muted); transform: translateY(-1mm); }
.pn { flex: none; font-variant-numeric: tabular-nums; color: var(--muted); }
.preview-note { grid-column: 1 / -1; text-align: center; color: #cfc9da; font-family: system-ui, sans-serif; font-size: 13px; }

@media screen {
  body { background: #2a2930; padding: 16px; }
  #book { display: grid; grid-template-columns: repeat(2, var(--pw)); justify-content: center; row-gap: 26px; }
  .page { box-shadow: 0 12px 30px rgba(0,0,0,0.45); }
  .page:first-child { grid-column: 2; }
}
@media print { #book { display: block; } }
`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(o.cover.title)}</title><style>${css}</style></head>
<body data-title="${esc(o.cover.title)}" data-preview-limit="${input.previewLimit ?? 0}">
<template id="page-tpl"><section class="page"><div class="inner"><div class="head"><span class="h-left"></span><span class="h-right"></span></div><div class="body"></div><div class="folio"></div></div></section></template>
<main id="book"></main>
<div id="flow">${items.join("\n")}</div>
<script>${PAGINATE_JS}</script>
</body></html>`;
}
