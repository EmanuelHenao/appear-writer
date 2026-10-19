import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Source } from "@/book/model";
import { suggestedBookOptions } from "@/book/options";
import type { BookProject } from "@/book/project";
import { bookHtml, exportEpub, exportPdf, exportPngs } from "@/book/service";
import { parsePlainText } from "@/import/text";
import { parseWhatsApp } from "@/import/whatsapp";
import { importFile } from "@/import";
import { getBrowser, openDoc } from "@/lib/render/browser";
import { chatZip } from "./fixtures";

const DATA = path.resolve("test-results/data-book");
const OUT = process.env.RENDER_OUT;

const messages = Array.from({ length: 12 }, (_, i) => {
  const day = (i % 9) + 1;
  const month = i < 6 ? 3 : 4;
  const who = i % 2 ? "Emanuel" : "Ana";
  const text = i === 5 ? "Este mensaje es muy largo. ".repeat(140) : `Mensaje número ${i + 1}: ¿sigues despierta? Acabo de ver la luna.`;
  return `${day}/${month}/24, 2${i % 4}:4${i % 10} - ${who}: ${text}`;
}).join("\n");

function chatSource(): Source {
  const chat = parseWhatsApp(messages);
  return { id: "chat1", name: "Ana", kind: "whatsapp", blocks: chat.blocks, meta: { messages: chat.blocks.length, firstDate: chat.blocks[0].date, lastDate: chat.blocks.at(-1)!.date } };
}

function proseSource(): Source {
  const long = "Era una mañana tranquila y el café todavía humeaba sobre la mesa. ".repeat(40);
  return {
    id: "pro1",
    name: "Diario de viaje",
    kind: "txt",
    blocks: parsePlainText(`# Lisboa\n\n${long}\n\n${long}\n\n# Oporto\n\n${long}\n\nCasa\nes cuando llego\ny ya me estabas esperando.`),
    meta: {},
  };
}

function project(sources: Source[]): BookProject {
  return {
    id: "testbook",
    createdAt: "",
    updatedAt: "",
    sources,
    options: suggestedBookOptions(sources),
    optionsTouched: false,
    ai: {},
    stock: { query: "", photos: [] },
    edits: { blocks: {}, inserts: [] },
  };
}

function pdfPages(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("render del libro", () => {
  beforeAll(async () => {
    process.env.DATA_DIR = DATA;
    await rm(DATA, { recursive: true, force: true });
    await mkdir(DATA, { recursive: true });
  });
  afterAll(async () => {
    (await getBrowser()).close();
  });

  it("un chat: un mensaje por página, capítulos por mes y mensajes largos partidos", async () => {
    const book = project([chatSource()]);
    const pdf = await exportPdf(book);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // portada + portadilla + índice + 2 aperturas + 12 mensajes (+ páginas extra del mensaje largo)
    expect(book.lastPages).toBeGreaterThanOrEqual(17);
    expect(pdfPages(pdf)).toBe(book.lastPages);
    if (OUT) await writeFile(path.join(OUT, "libro-chat.pdf"), pdf);
  });

  it("un texto en prosa reparte párrafos largos en varias páginas", async () => {
    const book = project([proseSource()]);
    book.options.cover.template = "tipografica";
    const pdf = await exportPdf(book);
    expect(book.lastPages).toBeGreaterThan(5);
    if (OUT) await writeFile(path.join(OUT, "libro-prosa.pdf"), pdf);
  });

  it("los PNG por página tienen el tamaño A5 con sangrado a 2x", async () => {
    const book = project([chatSource()]);
    book.options.cover.template = "lino";
    const pngs = await exportPngs(book);
    expect(pngs.length).toBeGreaterThan(10);
    const w = pngs[0].readUInt32BE(16);
    const h = pngs[0].readUInt32BE(20);
    // 154 × 216 mm a 96 ppp y escala 2
    expect(w).toBe(Math.ceil((154 * 96) / 25.4) * 2);
    expect(h).toBe(Math.ceil((216 * 96) / 25.4) * 2);
    if (OUT) for (const [i, png] of pngs.slice(0, 8).entries()) await writeFile(path.join(OUT, `pagina-${i + 1}.png`), png);
  });

  it("el EPUB tiene la estructura mínima válida (y pasa epubcheck si está disponible)", async () => {
    const withPhotos = await importFile("testbook", { name: "Chat de WhatsApp con Ana.zip", data: await chatZip() });
    const book = project([withPhotos, proseSource()]);
    const epub = await exportEpub(book);
    const zip = await JSZip.loadAsync(epub);
    const names = Object.keys(zip.files);
    expect(names[0]).toBe("mimetype");
    expect(await zip.file("mimetype")!.async("string")).toBe("application/epub+zip");
    expect(names).toContain("OEBPS/content.opf");
    expect(names).toContain("OEBPS/nav.xhtml");
    expect(names).toContain("OEBPS/images/cover.png");
    expect(names.filter((n) => /cap-\d+\.xhtml$/.test(n)).length).toBe(4);
    expect(names.filter((n) => n.startsWith("OEBPS/images/img"))).toHaveLength(2);
    const file = path.join(DATA, "libro.epub");
    await writeFile(file, epub);
    if (OUT) await writeFile(path.join(OUT, "libro.epub"), epub);
    const jar = process.env.EPUBCHECK_JAR;
    if (jar) {
      const out = execFileSync("java", ["-jar", jar, file], { encoding: "utf8" });
      expect(out).toMatch(/0 errores fatales \/ 0 errores|0 fatals \/ 0 errors/);
    }
  });

  it("v2: burbujas de chat con separadores por día, PDF y EPUB válidos", async () => {
    const withPhotos = await importFile("testbook", { name: "Chat de WhatsApp con Ana.zip", data: await chatZip() });
    const book = project([withPhotos]);
    book.options.content = { ...book.options.content, bubbles: true, onePerPage: false, rightAuthor: "Emanuel", showTime: true };
    const html = await bookHtml(book, "print");
    expect(html).toContain('class="bubble left"');
    expect(html).toContain('class="bubble right"');
    expect(html).toContain("14 de marzo de 2024");
    const pdf = await exportPdf(book);
    // portada + portadilla + índice + capítulos con burbujas: mucho menos que un mensaje por página
    expect(book.lastPages).toBeLessThan(10);
    if (OUT) {
      await writeFile(path.join(OUT, "libro-burbujas.pdf"), pdf);
      const pngs = await exportPngs(book);
      for (const [i, png] of pngs.entries()) await writeFile(path.join(OUT, `burbujas-${i + 1}.png`), png);
    }
    const epub = await exportEpub(book);
    const file = path.join(DATA, "burbujas.epub");
    await writeFile(file, epub);
    if (process.env.EPUBCHECK_JAR) {
      const out = execFileSync("java", ["-jar", process.env.EPUBCHECK_JAR, file], { encoding: "utf8" });
      expect(out).toMatch(/0 errores fatales \/ 0 errores|0 fatals \/ 0 errors/);
    }
  });

  it("v6: ocultos, diseños especiales y páginas añadidas en PDF, vista previa y EPUB", async () => {
    const withPhotos = await importFile("testbook", { name: "Chat de WhatsApp con Ana.zip", data: await chatZip() });
    const book = project([withPhotos, chatSource()]);
    const keys = withPhotos.blocks.map((b, i) => ({ b, key: `${withPhotos.id}:${i}` }));
    const photoMsgs = keys.filter((x) => x.b.type === "message" && x.b.media.length);
    const textMsgs = keys.filter((x) => x.b.type === "message" && x.b.text && !x.b.media.length);
    expect(photoMsgs.length).toBeGreaterThanOrEqual(2);
    const [p1, p2] = photoMsgs;
    const media = p1.b.type === "message" ? p1.b.media[0] : "";
    book.edits = {
      blocks: {
        [textMsgs[0].key]: { design: "cita", align: "centro" },
        [textMsgs[1].key]: { hidden: true },
        [p1.key]: { design: "foto-completa", photoText: "encima" },
        [p2.key]: { design: "foto-texto" },
        "chat1:2": { chapter: { title: "Capítulo a mano" } },
        "chat1:3": { photos: { hidden: [], place: "antes" } },
      },
      inserts: [
        { id: "sep", at: textMsgs[0].key, side: "antes", kind: "separador", title: "El viaje" },
        { id: "libre", at: textMsgs[0].key, side: "despues", kind: "libre", title: "Una nota", runs: [{ t: "Primer párrafo.\n\nSegundo párrafo." }] },
        { id: "img", at: "chat1:4", side: "despues", kind: "imagen", fit: "enmarcada", caption: "Pie de foto", photo: { url: `/api/files/books/testbook/media/${encodeURIComponent(media)}` } },
        { id: "blank", at: "chat1:5", side: "antes", kind: "blanco" },
      ],
    };
    const html = await bookHtml(book, "print");
    const hiddenText = textMsgs[1].b.type === "message" ? textMsgs[1].b.text : "";
    expect(html).not.toContain(`data-key="${textMsgs[1].key}"`);
    expect(html).toContain(`class="cita"`);
    expect(html).toContain(`class="veil"`);
    expect(html).toContain(`class="pt-photos n`);
    expect(html).toContain(`style="text-align:center"`);
    expect(html).toContain("Capítulo a mano");
    expect(html).toContain(`class="sep-title">El viaje`);
    expect(html).toContain("Segundo párrafo.");
    expect(html).toContain(`data-page-class="blank-page nohead nofolio"`);
    expect(html).toContain("http://appear.local/data/books/testbook/media/");
    expect(hiddenText.length).toBeGreaterThan(0);

    const pdf = await exportPdf(book);
    expect(pdfPages(pdf)).toBe(book.lastPages);
    if (OUT) {
      await writeFile(path.join(OUT, "libro-v6.pdf"), pdf);
      const pngs = await exportPngs(book);
      for (const [i, png] of pngs.slice(0, 14).entries()) await writeFile(path.join(OUT, `v6-${i + 1}.png`), png);
    }

    // Vista previa centrada en un mensaje: ventana de páginas alrededor y foco marcado.
    const preview = await bookHtml(book, "preview", 6, false, "chat1:9");
    expect(preview).toContain('data-focus="chat1:9"');

    const epub = await exportEpub(book);
    const zip = await JSZip.loadAsync(epub);
    const text = (await Promise.all(Object.keys(zip.files).filter((n) => n.endsWith(".xhtml")).map((n) => zip.file(n)!.async("string")))).join("\n");
    expect(text).toContain('class="cita"');
    expect(text).toContain("El viaje");
    expect(text).toContain("Capítulo a mano");
    expect(text).toContain("Pie de foto");
    const file = path.join(DATA, "v6.epub");
    await writeFile(file, epub);
    if (process.env.EPUBCHECK_JAR) {
      const out = execFileSync("java", ["-jar", process.env.EPUBCHECK_JAR, file], { encoding: "utf8" });
      expect(out).toMatch(/0 errores fatales \/ 0 errores|0 fatals \/ 0 errors/);
    }
  });

  it("v6: el texto con formato se conserva al partirse entre páginas", async () => {
    const prose = proseSource();
    const book = project([prose]);
    const long = prose.blocks[1].type === "paragraph" ? prose.blocks[1].text : "";
    const boldLen = long.length - 200;
    book.edits = {
      blocks: { [`${prose.id}:1`]: { runs: [{ t: long.slice(0, 100) }, { t: long.slice(100, 100 + boldLen), b: true, font: "lora", color: "accent" }, { t: long.slice(100 + boldLen) }] } },
      inserts: [],
    };
    const html = await bookHtml(book, "print");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("lora");
    const { page, context } = await openDoc({ html, width: 800, height: 1000, scale: 1, media: "print", readySelector: "body[data-ready]" });
    const bold = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll(".page span[style*='font-weight:700']"));
      return { pages: new Set(spans.map((s) => s.closest(".page"))).size, chars: spans.reduce((a, s) => a + (s.textContent?.length ?? 0), 0) };
    });
    await context.close();
    // El párrafo ocupa varias páginas y la negrita sigue en todas.
    expect(bold.pages).toBeGreaterThanOrEqual(2);
    // Siguen todos los caracteres en negrita, menos los espacios que se recortan al partir.
    expect(bold.chars).toBeGreaterThan(boldLen - 10);
  });

  it("la vista previa corta en el límite de páginas", async () => {
    const html = await bookHtml(project([chatSource()]), "preview", 6);
    expect(html).toContain('data-preview-limit="6"');
    expect(html).toContain("/api/fonts/@fontsource-variable/cormorant-garamond/files/");
  });
});
