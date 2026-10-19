import "server-only";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { FONTS, type FontId } from "@/design/fonts";
import { nodeModules } from "@/lib/render/fontcss";
import { dataPath } from "@/lib/storage";
import { esc } from "./covers";
import { roman } from "./html";
import { bookPalette, type BookOptions } from "./options";
import { formatDate, type Chapter } from "./structure";

// EPUB 3 refluido para lectores electrónicos. Las fuentes viajan dentro
// del archivo; los lectores que no las admiten usan su serif propia.

interface EpubInput {
  bookId: string;
  chapters: Chapter[];
  options: BookOptions;
  coverPng?: Buffer;
}

const xhtml = (title: string, body: string, extraHead = "") => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="es" lang="es">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/>${extraHead}</head>
<body>${body}</body>
</html>`;

async function fontFiles(id: FontId): Promise<{ name: string; data: Buffer; css: string }[]> {
  const f = FONTS[id];
  const out: { name: string; data: Buffer; css: string }[] = [];
  for (const sheet of f.css) {
    const pkg = sheet.split("/").slice(0, 2).join("/");
    const raw = await readFile(path.join(nodeModules(), sheet), "utf8");
    for (const block of raw.split(/(?=\/\*)/)) {
      if (!/\/\*[^*]*-latin-/.test(block) || /-latin-ext-/.test(block)) continue;
      const file = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
      if (!file) continue;
      const data = await readFile(path.join(nodeModules(), pkg, "files", file));
      const style = block.match(/font-style:\s*(\w+)/)?.[1] ?? "normal";
      const weight = block.match(/font-weight:\s*([\d ]+)/)?.[1]?.trim() ?? "400";
      out.push({
        name: file,
        data,
        css: `@font-face { font-family: "Libro"; font-style: ${style}; font-weight: ${weight}; src: url(fonts/${file}) format("woff2"); }`,
      });
    }
  }
  return out;
}

/** Tipo real de una imagen por sus primeros bytes. */
export function sniffImage(data: Buffer): { ext: string; type: string } | null {
  if (data.length < 12) return null;
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return { ext: "png", type: "image/png" };
  if (data[0] === 0xff && data[1] === 0xd8) return { ext: "jpg", type: "image/jpeg" };
  if (data.subarray(0, 4).toString("ascii") === "GIF8") return { ext: "gif", type: "image/gif" };
  if (data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

export async function buildEpub(input: EpubInput): Promise<Buffer> {
  const o = input.options;
  const p = bookPalette(o.palette);
  const title = o.cover.title || "Sin título";
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );

  const manifest: string[] = [];
  const spine: string[] = [];
  const add = (id: string, href: string, type: string, props?: string) =>
    manifest.push(`<item id="${id}" href="${href}" media-type="${type}"${props ? ` properties="${props}"` : ""}/>`);

  const fonts = await fontFiles(o.font as FontId);
  fonts.forEach((f, i) => {
    zip.file(`OEBPS/fonts/${f.name}`, f.data);
    add(`font${i}`, `fonts/${f.name}`, "font/woff2");
  });

  const css = `${fonts.map((f) => f.css).join("\n")}
body { font-family: "Libro", serif; line-height: 1.5; color: ${p.ink}; }
h1, h2 { font-weight: 500; text-align: center; }
.cover { margin: 0; padding: 0; text-align: center; }
.cover img { max-width: 100%; max-height: 100%; }
.title { text-align: center; margin-top: 30%; }
.title h1 { font-size: 2em; margin-bottom: 0.3em; }
.title .sub { font-style: italic; color: ${p.muted}; }
.title .author { letter-spacing: 0.2em; text-transform: uppercase; font-size: 0.8em; color: ${p.muted}; margin-top: 2em; }
.dedication { font-style: italic; text-align: center; margin-top: 35%; }
.ch-eyebrow { text-align: center; letter-spacing: 0.3em; text-transform: uppercase; font-size: 0.75em; color: ${p.muted}; margin-top: 3em; }
.ch-sub { text-align: center; font-style: italic; color: ${p.muted}; margin-bottom: 2em; }
.orn { text-align: center; color: ${p.accent}; }
p.para { margin: 0; text-indent: 1.4em; text-align: justify; }
p.para.first { text-indent: 0; }
p.verse { text-indent: 0; margin: 0 0 1em 1em; white-space: pre-line; }
h3 { font-size: 1.1em; margin: 1.2em 0 0.4em; }
.msg { margin: 0 0 1.2em; }
.msg.own { break-before: page; page-break-before: always; text-align: center; margin-top: 25%; }
.msg.own .text { font-size: 1.3em; }
.msg .text { margin: 0; white-space: pre-line; }
.msg .meta { margin: 0.3em 0 0; font-size: 0.7em; letter-spacing: 0.15em; text-transform: uppercase; color: ${p.muted}; }
.photos { text-align: center; margin: 0 0 0.6em; }
.photos img { max-width: 80%; max-height: 18em; }
figure { margin: 1em 0; text-align: center; }
figure img { max-width: 100%; }
nav ol { list-style: none; padding: 0; }
`;
  zip.file("OEBPS/style.css", css);
  add("css", "style.css", "text/css");

  if (input.coverPng) {
    zip.file("OEBPS/images/cover.png", input.coverPng);
    add("cover-image", "images/cover.png", "image/png", "cover-image");
    zip.file("OEBPS/cover.xhtml", xhtml(title, `<div class="cover"><img src="images/cover.png" alt="${esc(title)}"/></div>`));
    add("cover", "cover.xhtml", "application/xhtml+xml");
    spine.push(`<itemref idref="cover"/>`);
  }

  zip.file(
    "OEBPS/title.xhtml",
    xhtml(
      title,
      `<section class="title" epub:type="titlepage"><h1>${esc(title)}</h1>${o.cover.subtitle ? `<p class="sub">${esc(o.cover.subtitle)}</p>` : ""}${o.cover.author ? `<p class="author">${esc(o.cover.author)}</p>` : ""}</section>`,
    ),
  );
  add("title", "title.xhtml", "application/xhtml+xml");
  spine.push(`<itemref idref="title"/>`);

  if (o.content.dedication.trim()) {
    zip.file("OEBPS/dedication.xhtml", xhtml("Dedicatoria", `<section class="dedication" epub:type="dedication"><p>${esc(o.content.dedication.trim())}</p></section>`));
    add("dedication", "dedication.xhtml", "application/xhtml+xml");
    spine.push(`<itemref idref="dedication"/>`);
  }

  // Cada imagen se lee una vez para conocer su tipo real por el contenido:
  // los lectores rechazan un PNG con extensión .jpg.
  const images = new Map<string, { out: string; data: Buffer; type: string } | null>();
  for (const c of input.chapters) {
    for (const b of c.blocks) {
      const files = b.type === "image" ? [b.src] : b.type === "message" && o.content.chatPhotos ? b.media : [];
      for (const f of files) {
        if (images.has(f)) continue;
        try {
          const data = await readFile(dataPath("books", input.bookId, "media", f));
          const kind = sniffImage(data);
          images.set(f, kind ? { out: `img${images.size}.${kind.ext}`, data, type: kind.type } : null);
        } catch {
          images.set(f, null);
        }
      }
    }
  }
  const image = (file: string): string | null => {
    const img = images.get(file);
    return img ? `images/${img.out}` : null;
  };

  const chapters = input.chapters.filter((c) => c.blocks.length);
  const nav: string[] = [];
  chapters.forEach((c, i) => {
    const parts: string[] = [];
    if (chapters.length > 1) parts.push(`<p class="ch-eyebrow">Capítulo ${roman(i + 1)}</p>`);
    parts.push(`<h2>${esc(c.title)}</h2>`);
    if (o.content.ornaments) parts.push(`<p class="orn">❧</p>`);
    if (c.subtitle) parts.push(`<p class="ch-sub">${esc(c.subtitle)}</p>`);
    let first = true;
    for (const b of c.blocks) {
      if (b.type === "heading") parts.push(`<h3>${esc(b.text)}</h3>`);
      else if (b.type === "paragraph") {
        const verse = b.text.includes("\n");
        parts.push(`<p class="${verse ? "verse" : `para${first ? " first" : ""}`}">${esc(b.text)}</p>`);
        first = false;
      } else if (b.type === "image") {
        const src = image(b.src);
        if (src) parts.push(`<figure><img src="${src}" alt=""/></figure>`);
      } else {
        const meta: string[] = [];
        if (o.content.showName) meta.push(esc(b.author));
        if (b.date && o.content.showDate) meta.push(formatDate(b.date, o.content.showTime));
        else if (b.date && o.content.showTime) meta.push(b.date.slice(11, 16));
        const srcs = o.content.chatPhotos ? b.media.map(image).filter((x): x is string => !!x) : [];
        const photos = srcs.length ? `<div class="photos">${srcs.map((src) => `<img src="${src}" alt=""/>`).join("")}</div>` : "";
        parts.push(
          `<div class="msg${o.content.onePerPage ? " own" : ""}">${photos}${b.text ? `<p class="text">${esc(b.text)}</p>` : ""}${meta.length ? `<p class="meta">${meta.join(" · ")}</p>` : ""}</div>`,
        );
      }
    }
    const name = `cap-${String(i + 1).padStart(3, "0")}.xhtml`;
    zip.file(`OEBPS/${name}`, xhtml(c.title, `<section epub:type="chapter">${parts.join("\n")}</section>`));
    add(`c${i}`, name, "application/xhtml+xml");
    spine.push(`<itemref idref="c${i}"/>`);
    nav.push(`<li><a href="${name}">${esc(c.title)}</a></li>`);
  });

  for (const img of images.values()) {
    if (!img) continue;
    zip.file(`OEBPS/images/${img.out}`, img.data);
    add(`i-${img.out.replace(/\W/g, "")}`, `images/${img.out}`, img.type);
  }

  zip.file(
    "OEBPS/nav.xhtml",
    xhtml("Índice", `<nav epub:type="toc" id="toc"><h1>Índice</h1><ol>${nav.join("")}</ol></nav>`),
  );
  add("nav", "nav.xhtml", "application/xhtml+xml", "nav");

  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="es">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:uuid:${randomUUID()}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:language>es</dc:language>
    ${o.cover.author ? `<dc:creator>${esc(o.cover.author)}</dc:creator>` : ""}
    <meta property="dcterms:modified">${modified}</meta>
    ${input.coverPng ? `<meta name="cover" content="cover-image"/>` : ""}
  </metadata>
  <manifest>
    ${manifest.join("\n    ")}
  </manifest>
  <spine>
    ${spine.join("\n    ")}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip", compression: "DEFLATE" });
}
