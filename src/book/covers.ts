import { readableOn } from "@/design/palettes";
import type { BookOptions, BookPalette } from "./options";

// Las cuatro portadas aprobadas en la galería (A, C, D y E). Todas las
// medidas usan --u = ancho de página / 420, la escala de las maquetas.

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const u = (n: number) => `calc(var(--u) * ${n})`;

function noise(id: string, freq: string, alpha: number, rgb = "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0") {
  return `<svg aria-hidden="true" width="100%" height="100%" style="position:absolute;inset:0"><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="${rgb}  0 0 0 ${alpha} 0"/></filter><rect width="100%" height="100%" fill="#000" filter="url(#${id})"/></svg>`;
}

interface CoverText {
  title: string;
  subtitle: string;
  author: string;
}

function tela(p: BookPalette, t: CoverText, serif: string): string {
  return `<div class="cover-art" style="background:${p.deep};color:${p.accent}">
  ${noise("tela", "0.7 0.05", 0.18)}
  <div style="position:absolute;inset:var(--cover-inset);border:1px solid ${p.accent};padding:${u(6)}">
    <div style="height:100%;box-sizing:border-box;border:1px solid ${p.accent}88;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:${u(56)} ${u(28)} ${u(40)};text-align:center">
      <div style="font-family:${serif};font-size:${u(11)};letter-spacing:0.4em;text-transform:uppercase">${esc(t.author)}</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:${u(18)}">
        <div style="font-family:${serif};font-size:${u(22)}">❦</div>
        <div style="font-family:${serif};font-weight:600;font-size:${u(46)};line-height:1.02;color:${p.onDeep};text-wrap:balance">${esc(t.title)}</div>
        <div style="width:${u(60)};height:1px;background:${p.accent}"></div>
        <div style="font-family:${serif};font-style:italic;font-size:${u(18)}">${esc(t.subtitle)}</div>
      </div>
      <div style="font-family:${serif};font-size:${u(11)};letter-spacing:0.3em;text-transform:uppercase">&nbsp;</div>
    </div>
  </div>
</div>`;
}

function tipografica(p: BookPalette, t: CoverText): string {
  const words = t.title.split(/\s+/).filter(Boolean);
  const half = Math.ceil(words.length / 2);
  const a = esc(words.slice(0, half).join(" "));
  const b = esc(words.slice(half).join(" "));
  // La palabra más larga manda: el título nunca se corta con guiones.
  const longest = Math.max(...words.map((w) => w.length), 1);
  const size = Math.min(t.title.length > 34 ? 54 : t.title.length > 22 ? 66 : 82, Math.floor(360 / (longest * 0.58)));
  return `<div class="cover-art" style="background:${p.deep};color:${p.onDeep}">
  <div style="position:absolute;inset:var(--cover-inset);padding:${u(34)} ${u(30)} ${u(30)};display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;justify-content:space-between;font-family:'Jost Variable',sans-serif;font-size:${u(11)};letter-spacing:0.24em;text-transform:uppercase"><span>${esc(t.author)}</span><span>${esc(t.subtitle.length < 24 ? t.subtitle : "")}</span></div>
    <div style="font-family:'Fraunces Variable',Georgia,serif;font-weight:700;font-size:${u(size)};line-height:0.9;letter-spacing:-0.03em;hyphens:manual">${a}${b ? `<br><span style="font-weight:300;font-style:italic">${b}</span>` : ""}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid ${p.onDeep};padding-top:${u(12)};font-family:'Jost Variable',sans-serif;font-size:${u(12)}"><span>${esc(t.subtitle.length >= 24 ? t.subtitle : "")}</span><span>&nbsp;</span></div>
  </div>
</div>`;
}

function formas(p: BookPalette, t: CoverText, serif: string): string {
  const light = readableOn(p.deep) === "#111111";
  const blend = light ? "multiply" : "screen";
  return `<div class="cover-art" style="background:${p.deep};color:${p.onDeep}">
  <div style="position:absolute;left:${u(70)};top:${u(120)};width:${u(190)};height:${u(190)};border-radius:50%;background:${light ? p.muted : p.soft};mix-blend-mode:${blend}"></div>
  <div style="position:absolute;left:${u(165)};top:${u(160)};width:${u(190)};height:${u(190)};border-radius:50%;background:${p.accent};mix-blend-mode:${blend}"></div>
  <div style="position:absolute;inset:var(--cover-inset);padding:${u(36)} ${u(34)} ${u(32)};display:flex;flex-direction:column;justify-content:space-between">
    <div style="font-family:'Jost Variable',sans-serif;font-size:${u(11)};letter-spacing:0.3em;text-transform:uppercase;opacity:0.85">${esc(t.author)}</div>
    <div style="display:flex;flex-direction:column;gap:${u(10)}">
      <div style="font-family:${serif};font-weight:500;font-size:${u(40)};line-height:1;text-wrap:balance">${esc(t.title)}</div>
      <div style="font-family:${serif};font-style:italic;font-size:${u(17)};opacity:0.85">${esc(t.subtitle)}</div>
    </div>
  </div>
</div>`;
}

function lino(p: BookPalette, t: CoverText, serif: string): string {
  const linen = p.id === "lino-natural" ? p.deep : p.soft;
  return `<div class="cover-art" style="background:${linen};color:${p.ink};display:flex;align-items:center;justify-content:center">
  ${noise("lino1", "0.04 0.9", 0.16, "0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.18")}
  ${noise("lino2", "0.9 0.04", 0.12, "0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.18")}
  <div style="position:relative;width:${u(250)};box-sizing:border-box;background:#FBF8F1;padding:${u(28)} ${u(24)};text-align:center;box-shadow:inset 0 0 0 1px ${p.soft}, 0 2px 4px rgba(60,45,20,.18);display:flex;flex-direction:column;gap:${u(10)};align-items:center">
    <div style="font-family:'Jost Variable',sans-serif;font-size:${u(10)};letter-spacing:0.32em;text-transform:uppercase;color:${p.muted}">${esc(t.author)}</div>
    <div style="font-family:${serif};font-weight:600;font-size:${u(30)};line-height:1.02;text-wrap:balance">${esc(t.title)}</div>
    <div style="width:${u(30)};height:1px;background:${p.muted}"></div>
    <div style="font-family:${serif};font-style:italic;font-size:${u(15)};color:${p.muted}">${esc(t.subtitle)}</div>
  </div>
</div>`;
}

export function coverHtml(options: BookOptions, p: BookPalette, serif: string): string {
  const t = { title: options.cover.title || "Sin título", subtitle: options.cover.subtitle, author: options.cover.author };
  switch (options.cover.template) {
    case "tipografica":
      return tipografica(p, t);
    case "formas":
      return formas(p, t, serif);
    case "lino":
      return lino(p, t, serif);
    default:
      return tela(p, t, serif);
  }
}
