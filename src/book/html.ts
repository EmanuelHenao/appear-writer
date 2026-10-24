import { fontStack, type FontId } from "@/design/fonts";
import type { PhotoRef } from "@/design/spec";
import { coverHtml, esc } from "./covers";
import { BLEED_MM, bookPalette, metaFlags, PAGE_SIZES, shownName, type BookOptions } from "./options";
import { hasFormat, type Run } from "./edits";
import { PAGINATE_JS } from "./paginate.js";
import { formatDate, formatLongDate, type Chapter, type KeyedBlock } from "./structure";

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
  /** Solo para la vista previa: clave del bloque alrededor del cual se muestran las páginas. */
  focusKey?: string;
  /** URL de una foto subida (páginas añadidas), según se vea en pantalla o en Chromium. */
  photoUrl?: (url: string) => string;
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
  const show = metaFlags(o, b.edit?.meta);
  if (show.name && b.author) parts.push(shownName(o, b.author));
  if (b.date && show.date) parts.push(formatDate(b.date, show.time));
  else if (b.date && show.time) parts.push(b.date.slice(11, 16));
  return parts.map(esc).join(" · ");
}

type MsgBlock = Extract<KeyedBlock, { type: "message" }>;

const SIZE_EM = { s: 0.85, m: 1, l: 1.3, xl: 1.65 } as const;

/** Texto con formato: cada tramo es un span con su estilo; sin formato, el texto tal cual. */
function textHtml(text: string, runs: Run[] | undefined): string {
  if (!runs || !hasFormat(runs)) return esc(text);
  return runs
    .map((r) => {
      const st: string[] = [];
      if (r.b) st.push("font-weight:700");
      if (r.i) st.push("font-style:italic");
      if (r.u) st.push("text-decoration:underline");
      if (r.font) st.push(`font-family:${fontStack(r.font).replace(/"/g, "'")}`);
      if (r.size) st.push(`font-size:${SIZE_EM[r.size]}em`);
      if (r.color) st.push(`color:var(--${r.color})`);
      return st.length ? `<span style="${esc(st.join(";"))}">${esc(r.t)}</span>` : esc(r.t);
    })
    .join("");
}

const keyAttr = (b: KeyedBlock) => ` data-key="${esc(b.key)}"`;
const ALIGN = { izquierda: "left", centro: "center", derecha: "right" } as const;
const alignAttr = (b: KeyedBlock) => (b.edit?.align ? ` style="text-align:${ALIGN[b.edit.align]}"` : "");

function photoUrls(b: MsgBlock, input: BookDocInput): string[] {
  return input.options.content.chatPhotos ? b.media.map((m) => input.mediaUrl(m)) : [];
}

function polaroids(urls: string[]): string {
  return urls.length ? `<div class="msg-photos${urls.length > 2 ? " many" : ""}">${urls.map((u) => `<figure class="polaroid"><img src="${esc(u)}" alt=""></figure>`).join("")}</div>` : "";
}

const chunk = <T,>(list: T[], n: number): T[][] => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/** Una página propia con las fotos del mensaje, antes de su texto. */
const photoPage = (b: KeyedBlock, urls: string[]) =>
  urls.length ? `<div class="ph-own" data-mode="own" data-page-class="photo-page"${keyAttr(b)}>${polaroids(urls)}</div>` : "";

const fullPhoto = (b: KeyedBlock, url: string, over = "") =>
  `<div class="pf" data-mode="own" data-page-class="photo-full nohead nofolio"${keyAttr(b)}><img src="${esc(url)}" alt="">${over}</div>`;

function messageHtml(b: MsgBlock, input: BookDocInput): string {
  const o = input.options;
  const e = b.edit;
  const meta = metaLine(b, o);
  const metaHtml = meta ? `<p class="meta" data-meta-end>${meta}</p>` : "";
  const k = keyAttr(b);
  const text = (cls: string) => (b.text ? `<p class="${cls}" data-split${alignAttr(b)}>${textHtml(b.text, e?.runs)}</p>` : "");
  const urls = photoUrls(b, input);
  const ownText = () => (b.text ? `<div class="msg-own" data-mode="own" data-page-class="msg-page" data-long-class="msg msg-long"${k}>${text("msg-text")}${metaHtml}</div>` : "");
  const cita = () =>
    `<div class="cita" data-mode="own" data-page-class="cita-page" data-long-class="msg msg-long"${k}><span class="q" aria-hidden="true">“</span>${text("cita-text")}<span class="cita-rule"></span>${metaHtml}</div>`;

  switch (e?.design) {
    case "cita":
      return photoPage(b, urls) + cita();
    case "foto-completa": {
      if (!urls.length) return cita();
      if (e.photoText === "encima" && b.text) {
        const over = `<div class="veil">${text("pf-text")}${metaHtml}</div>`;
        return urls.map((u, i) => fullPhoto(b, u, i === 0 ? over : "")).join("");
      }
      return urls.map((u) => fullPhoto(b, u)).join("") + ownText();
    }
    case "foto-texto": {
      if (!urls.length) return ownText();
      return chunk(urls, 2)
        .map(
          (pair, i) =>
            `<div class="photo-text" data-mode="own" data-page-class="photo-text-page"${k}><div class="pt-photos n${pair.length}">${pair
              .map((u) => `<figure class="frame"><img src="${esc(u)}" alt=""></figure>`)
              .join("")}</div>${i === 0 ? `${text("pt-text")}${metaHtml}` : ""}</div>`,
        )
        .join("");
    }
  }

  const place = e?.photos?.place ?? "junto";
  const before = place === "antes" || place === "ambas" ? photoPage(b, urls) : "";
  const images = place === "antes" ? "" : polaroids(urls);
  if (o.content.bubbles) {
    const right = !!o.content.rightAuthor && b.author === o.content.rightAuthor;
    const show = metaFlags(o, e?.meta);
    const time = b.date && show.time ? esc(b.date.slice(11, 16)) : "";
    const who = show.name && !right ? `<div class="b-author">${esc(shownName(o, b.author))}</div>` : "";
    return `${before}<div class="bubble ${right ? "right" : "left"}"${k}>${who}${images}${text("b-text")}${time ? `<span class="b-meta" data-meta-end>${time}</span>` : ""}</div>`;
  }
  if (o.content.onePerPage) {
    if (!b.text && !images) return before;
    return `${before}<div class="msg-own" data-mode="own" data-page-class="msg-page" data-long-class="msg msg-long"${k}>${images}${text("msg-text")}${metaHtml}</div>`;
  }
  return `${before}<div class="msg"${k}>${images}${text("msg-text")}${metaHtml}</div>`;
}

/** Un mensaje que puede compartir página con los vecinos: «Uno por página», sin diseño especial ni fotos aparte. */
function joinable(b: KeyedBlock, o: BookOptions): b is MsgBlock {
  return b.type === "message" && o.content.onePerPage && !o.content.bubbles && (!b.edit?.design || b.edit.design === "normal") && (b.edit?.photos?.place ?? "junto") === "junto";
}

/** Varios mensajes juntados en una página. Si no caben, el paginador los pasa a texto corrido. */
function joinedHtml(list: MsgBlock[], input: BookDocInput): string {
  const items = list.map((b) => {
    const meta = metaLine(b, input.options);
    const text = b.text ? `<p class="msg-text" data-split${alignAttr(b)}>${textHtml(b.text, b.edit?.runs)}</p>` : "";
    return `<div class="msg-item"${keyAttr(b)}>${polaroids(photoUrls(b, input))}${text}${meta ? `<p class="meta" data-meta-end>${meta}</p>` : ""}</div>`;
  });
  return `<div class="msg-own msg-joined" data-mode="own" data-page-class="msg-page" data-joined="1">${items.join("")}</div>`;
}

/** Parte los tramos en párrafos por las líneas en blanco, sin perder el formato. */
export function splitParagraphs(runs: Run[]): Run[][] {
  const out: Run[][] = [[]];
  for (const r of runs) {
    const pieces = r.t.split(/\n\s*\n/);
    pieces.forEach((t, i) => {
      if (i > 0) out.push([]);
      if (t) out[out.length - 1].push({ ...r, t });
    });
  }
  return out
    .map((rs) => {
      const trimmed = rs.map((r) => ({ ...r }));
      if (trimmed[0]) trimmed[0].t = trimmed[0].t.replace(/^\s+/, "");
      const last = trimmed[trimmed.length - 1];
      if (last) last.t = last.t.replace(/\s+$/, "");
      return trimmed.filter((r) => r.t);
    })
    .filter((rs) => rs.length);
}

function insertHtml(b: Extract<KeyedBlock, { type: "insert" }>, input: BookDocInput): string {
  const ins = b.insert;
  const k = keyAttr(b);
  const url = ins.photo ? (input.photoUrl ? input.photoUrl(ins.photo.url) : ins.photo.url) : "";
  switch (ins.kind) {
    case "separador":
      return `<div class="sep" data-mode="own" data-page-class="sep-page nohead nofolio"${k}>${ornament(input.options, "❦")}${ins.title ? `<div class="sep-title">${esc(ins.title)}</div>` : ""}${ins.caption ? `<div class="sep-sub">${esc(ins.caption)}</div>` : ""}</div>`;
    case "blanco":
      return `<div class="blank" data-mode="own" data-page-class="blank-page nohead nofolio"${k}></div>`;
    case "imagen":
      if (!url) return "";
      if (ins.fit === "enmarcada")
        return `<div class="ph-own" data-mode="own" data-page-class="photo-page"${k}><figure class="frame big"><img src="${esc(url)}" alt="">${ins.caption ? `<figcaption>${esc(ins.caption)}</figcaption>` : ""}</figure></div>`;
      return fullPhoto(b, url);
    case "libre": {
      const paras = splitParagraphs(ins.runs ?? []);
      if (!paras.length && !ins.title) return "";
      // La página libre empieza siempre en una página nueva.
      const start = ` data-newpage="1" data-page-class="text"`;
      const title = ins.title ? `<h3 class="libre-title"${k}${start}>${esc(ins.title)}</h3>` : "";
      return title + paras.map((rs, i) => `<p class="para libre" data-split${k}${i === 0 && !title ? start : ""}>${textHtml(rs.map((r) => r.t).join(""), rs)}</p>`).join("");
    }
  }
}

function blockHtml(b: KeyedBlock, input: BookDocInput, first: boolean): string {
  switch (b.type) {
    case "heading":
      return `<h3 class="sub">${esc(b.text)}</h3>`;
    case "image":
      return `<figure class="figure"><img src="${esc(input.mediaUrl(b.src))}" alt="">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ""}</figure>`;
    case "paragraph": {
      const verse = b.text.includes("\n");
      return `<p class="para${verse ? " verse" : ""}${first && !verse ? " first" : ""}" data-split${keyAttr(b)}${alignAttr(b)}>${textHtml(b.text, b.edit?.runs)}</p>`;
    }
    case "message":
      return messageHtml(b, input);
    case "insert":
      return insertHtml(b, input);
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
  // El paginador escribe «Capítulo N» al final, así cada capítulo no depende de su posición.
  const eyebrow = total > 1 ? `<div class="ch-eyebrow" data-roman></div>` : "";
  const inner = `${photo ? `<figure class="ch-photo"><img src="${esc(photo.url)}" alt=""></figure>` : ""}
    <div class="ch-head">${eyebrow}<h2 class="ch-title">${esc(c.title)}</h2>${ornament(o, "❧")}${c.subtitle ? `<div class="ch-sub">${esc(c.subtitle)}</div>` : ""}</div>
    ${photo?.credit ? `<div class="credit">Foto: ${esc(photo.credit)}</div>` : ""}`;
  const attrs = `data-chapter="${esc(c.title)}" data-chapter-key="${esc(c.key)}"`;
  return own
    ? `<div class="chapter-own" data-mode="own" data-page-class="chapter-page nohead" ${attrs}>${inner}</div>`
    : `<div class="chapter-flow" data-newpage="1" data-page-class="text chapter-start nohead" ${attrs}>${inner}</div>`;
}

/** Huella corta de una sección: si no cambia, la vista previa no la vuelve a paginar. */
function hashOf(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36) + text.length.toString(36);
}

export interface BookSegment {
  key: string;
  hash: string;
  html: string;
}

/**
 * El libro en secciones: el principio (portada, portadilla, dedicatoria e
 * índice) y cada capítulo. Cada sección empieza en página nueva.
 */
export function bookSegments(input: BookDocInput): BookSegment[] {
  const o = input.options;
  const p = bookPalette(o.palette);
  const serif = fontStack(o.font as FontId);
  const chapters = input.chapters.filter((c) => c.blocks.length);
  const segments: { key: string; items: string[] }[] = [];
  let items: string[] = [];
  segments.push({ key: "_inicio", items });

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
    items = [];
    segments.push({ key: c.key, items });
    const isChat = c.blocks.some((b) => b.type === "message");
    const own = (isChat && o.content.onePerPage && !o.content.bubbles) || (o.content.stockPhotos && !!input.stock?.length);
    items.push(chapterOpener(c, i, chapters.length, input, own));
    let first = !own;
    let lastDay = "";
    // Mensajes que el usuario juntó en una misma página.
    let joined: MsgBlock[] = [];
    const flush = () => {
      if (joined.length) items.push(joined.length === 1 ? blockHtml(joined[0], input, false) : joinedHtml(joined, input));
      joined = [];
    };
    for (const b of c.blocks) {
      if (joined.length && !joinable(b, o)) flush();
      if (joinable(b, o) && (joined.length || b.edit?.join)) {
        joined.push(b);
        if (!b.edit?.join) flush();
        continue;
      }
      // En modo burbujas, un separador cada vez que cambia el día.
      if (o.content.bubbles && b.type === "message" && b.date && o.content.showDate) {
        const day = b.date.slice(0, 10);
        if (day !== lastDay) items.push(`<div class="day-sep"><span>${esc(formatLongDate(day))}</span></div>`);
        lastDay = day;
      }
      items.push(blockHtml(b, input, first));
      if (b.type === "paragraph") first = false;
    }
    flush();
  });
  return segments.map((sg) => {
    const html = sg.items.join("\n");
    return { key: sg.key, hash: hashOf(html), html };
  });
}

export function buildBookHtml(input: BookDocInput): string {
  const o = input.options;
  const p = bookPalette(o.palette);
  const g = pageGeometry(o);
  const serif = fontStack(o.font as FontId);
  const pt = BODY_PT[o.fontScale] * (o.pageSize === "cuadrado" ? 1.08 : 1);
  const segments = bookSegments(input);

  const m = g.margin;
  const css = `
${input.fontCss}
@page { size: ${g.w}mm ${g.h}mm; margin: 0; }
:root { --pw: ${g.w}mm; --ph: ${g.h}mm; --u: calc(${g.w}mm / 420); --cover-inset: calc(var(--u) * 28 + ${g.bleed}mm);
  --paper: ${p.paper}; --ink: ${p.ink}; --muted: ${p.muted}; --accent: ${p.accent}; --deep: ${p.deep}; --on-deep: ${p.onDeep}; --soft: ${p.soft}; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: ${serif}; color: var(--ink); font-size: ${pt}pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
/* Lo que espera turno no se maqueta: así cada medida solo mira la página que se está llenando. */
#flow { display: none; }
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
.msg-joined { gap: 8mm; }
.msg-item { display: flex; flex-direction: column; align-items: center; gap: 2.5mm; }
.msg-joined .msg-text { font-size: 1.3em; }
.msg-photos { display: flex; flex-wrap: wrap; justify-content: center; gap: 4mm; }
.polaroid { margin: 0; background: #fff; padding: 2.4mm 2.4mm 7mm; box-shadow: 0 1mm 3mm rgba(60,45,20,0.18); transform: rotate(-1.5deg); }
.polaroid:nth-child(2n) { transform: rotate(1.5deg); }
.polaroid img { display: block; max-width: 70mm; max-height: 62mm; object-fit: cover; }
.msg .polaroid img { max-height: 50mm; }
.msg-long .msg-text { font-size: 1.15em; }

.bubble { position: relative; width: fit-content; max-width: 78%; margin: 0 0 2.2mm; padding: 2mm 3mm 1.6mm; border-radius: 3.2mm; background: #FFFFFF; box-shadow: 0 0.3mm 0.6mm rgba(0,0,0,0.08); clear: both; font-size: 0.92em; line-height: 1.38; }
.bubble.left { margin-right: auto; border-top-left-radius: 0.8mm; }
.bubble.right { margin-left: auto; background: color-mix(in srgb, var(--accent) 30%, #FFFFFF); border-top-right-radius: 0.8mm; }
.bubble.cont { border-top-left-radius: 3.2mm; border-top-right-radius: 3.2mm; }
.b-author { font-size: 0.7em; font-weight: 600; letter-spacing: 0.06em; color: var(--accent); margin-bottom: 0.5mm; }
.b-text { margin: 0; white-space: pre-line; }
.b-meta { display: block; text-align: right; font-size: 0.62em; color: var(--muted); margin-top: 0.4mm; }
.bubble .polaroid { transform: none; padding: 0; box-shadow: none; background: transparent; }
.bubble .polaroid img { max-width: 100%; max-height: 60mm; border-radius: 2mm; }
.day-sep { text-align: center; margin: 3mm 0 3mm; }
.day-sep span { display: inline-block; font-size: 0.62em; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); background: var(--soft); border-radius: 99px; padding: 0.8mm 3mm; }
.toc-title { font-size: 1.6em; font-weight: 500; text-align: center; margin: 10mm 0 8mm; }
.toc-entry { display: flex; align-items: baseline; gap: 2.5mm; margin: 0 0 2.2mm; }
.toc-n { width: 9mm; color: var(--muted); font-size: 0.8em; flex: none; }
.toc-t { flex: none; max-width: 78%; }
.toc-dots { flex: 1; border-bottom: 0.25mm dotted var(--muted); transform: translateY(-1mm); }
.pn { flex: none; font-variant-numeric: tabular-nums; color: var(--muted); }
/* Diseños especiales de un mensaje y páginas añadidas */
.page.cita-page .body, .page.photo-page .body, .page.photo-text-page .body, .page.sep-page .body { display: flex; flex-direction: column; justify-content: center; }
.cita { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4mm; padding: 0 4mm; }
.cita .q { font-size: 4.4em; line-height: 1; height: 0.5em; color: var(--accent); }
.cita-text { margin: 0; font-size: 1.85em; line-height: 1.3; font-style: italic; white-space: pre-line; text-wrap: balance; }
.cita-rule { width: 12mm; height: 0.25mm; background: var(--accent); }
.page.photo-full .inner { padding: 0; }
.page.photo-full .head, .page.photo-full .folio { display: none; }
.pf { position: absolute; inset: 0; }
.pf > img { width: 100%; height: 100%; object-fit: cover; display: block; }
.veil { position: absolute; left: 0; right: 0; bottom: 0; padding: 34mm ${m.outer}mm ${m.bottom}mm ${m.inner}mm; background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--deep) 92%, transparent) 45%); color: var(--on-deep); }
.pf-text { margin: 0; font-size: 1.35em; line-height: 1.32; white-space: pre-line; text-wrap: pretty; }
.veil .meta { color: var(--on-deep); opacity: 0.85; }
.ph-own { display: flex; flex-direction: column; align-items: center; gap: 4mm; }
.ph-own .polaroid img { max-width: 100%; max-height: 120mm; }
.ph-own .msg-photos.many .polaroid img { max-width: 52mm; max-height: 58mm; }
.photo-text { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 5mm; }
.pt-photos { display: grid; gap: 3mm; width: 100%; }
.pt-photos.n2 { grid-template-columns: 1fr 1fr; }
.frame { margin: 0; background: #fff; padding: 2mm; box-shadow: 0 0.6mm 2mm rgba(60,45,20,0.18); }
.frame img { display: block; width: 100%; max-height: 95mm; object-fit: cover; }
.pt-photos.n2 .frame img { height: 72mm; }
.frame.big { width: auto; max-width: 100%; }
.frame.big img { width: auto; max-width: 100%; max-height: 135mm; margin: 0 auto; }
.frame figcaption { font-style: italic; font-size: 0.85em; color: var(--muted); text-align: center; padding-top: 2mm; }
.pt-text { margin: 0; font-size: 1.15em; line-height: 1.4; white-space: pre-line; text-wrap: pretty; }
.sep { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 5mm; }
.sep .orn { font-size: 1.5em; }
.sep-title { font-size: 2em; font-weight: 500; line-height: 1.1; text-wrap: balance; }
.sep-sub { font-size: 0.7em; letter-spacing: 0.3em; text-transform: uppercase; color: var(--muted); }
.libre-title { font-size: 1.5em; font-weight: 500; text-align: center; margin: 8mm 0 6mm; }
.para.libre + .para.libre { text-indent: 1.4em; }
body.previewing [data-key] { cursor: pointer; }
body.previewing [data-key]:hover { outline: 0.3mm dashed rgba(124, 104, 230, 0.55); outline-offset: 1.5mm; }
body.previewing .picked { outline: 0.5mm solid #8f7cf0 !important; outline-offset: 1.5mm; box-shadow: 0 0 0 2.2mm rgba(182, 166, 255, 0.28); border-radius: 0.6mm; }
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
<body data-title="${esc(o.cover.title)}" data-preview-limit="${input.previewLimit ?? 0}"${input.focusKey ? ` data-focus="${esc(input.focusKey)}"` : ""}>
<template id="page-tpl"><section class="page"><div class="inner"><div class="head"><span class="h-left"></span><span class="h-right"></span></div><div class="body"></div><div class="folio"></div></div></section></template>
<main id="book"></main>
<div id="flow">${segments.map((sg) => `<div data-seg="${esc(sg.key)}" data-hash="${sg.hash}">${sg.html}</div>`).join("\n")}</div>
<script>${PAGINATE_JS}</script>
</body></html>`;
}
