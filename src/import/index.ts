import "server-only";
import JSZip from "jszip";
import { parse as parseHtml, type HTMLElement } from "node-html-parser";
import type { Block, Source } from "@/book/model";
import { dataPath, newId, writeBinary } from "@/lib/storage";
import { paragraphsFromPdfText, parsePlainText } from "./text";
import { chatNameFromFile, looksLikeWhatsApp, parseWhatsApp } from "./whatsapp";

// Convierte cualquier archivo subido en una fuente del libro. Las imágenes
// se guardan en data/books/<libro>/media y los bloques las nombran.

export const MAX_UPLOAD = 200 * 1024 * 1024;

export function safeMediaName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(0, 120) || `img-${newId()}`;
}

async function saveMedia(bookId: string, name: string, data: Buffer | Uint8Array): Promise<string> {
  const safe = safeMediaName(name);
  await writeBinary(dataPath("books", bookId, "media", safe), data);
  return safe;
}

function chatSource(name: string, raw: string): Source {
  const chat = parseWhatsApp(raw);
  const dates = chat.blocks.map((b) => b.date).filter((d): d is string => !!d);
  return {
    id: newId(),
    name: chatNameFromFile(name),
    kind: "whatsapp",
    blocks: chat.blocks,
    meta: {
      participants: chat.participants,
      messages: chat.blocks.length,
      images: chat.blocks.reduce((n, b) => n + b.media.length, 0),
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
      skipped: chat.skipped,
    },
  };
}

function titleFromFile(name: string): string {
  return name.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ").trim() || "Sin título";
}

async function fromZip(bookId: string, name: string, data: Buffer): Promise<Source> {
  const zip = await JSZip.loadAsync(data);
  const files = Object.values(zip.files).filter((f) => !f.dir && !f.name.startsWith("__MACOSX"));
  const txts = files.filter((f) => /\.txt$/i.test(f.name));
  if (!txts.length) throw new Error("El ZIP no contiene el chat (.txt). Exporta el chat desde WhatsApp con «Incluir archivos».");
  const chatFile = txts.find((f) => /_chat\.txt$/i.test(f.name)) ?? txts[0];
  const raw = await chatFile.async("string");
  if (!looksLikeWhatsApp(raw)) throw new Error("El ZIP no parece una exportación de chat de WhatsApp.");
  const source = chatSource(name, raw);
  // Solo se copian las imágenes que el chat menciona.
  const wanted = new Set(source.blocks.flatMap((b) => (b.type === "message" ? b.media : [])));
  const byBase = new Map(files.map((f) => [f.name.replace(/^.*\//, ""), f]));
  let saved = 0;
  for (const block of source.blocks) {
    if (block.type !== "message" || !block.media.length) continue;
    const kept: string[] = [];
    for (const m of block.media) {
      const f = byBase.get(m);
      if (!f || !wanted.has(m)) continue;
      kept.push(await saveMedia(bookId, m, await f.async("nodebuffer")));
      saved++;
    }
    block.media = kept;
  }
  source.meta.images = saved;
  return source;
}

function blockFromElement(el: HTMLElement): Block[] {
  const tag = el.tagName?.toLowerCase();
  const text = el.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
  const imgs = el.querySelectorAll("img").map((img) => ({ type: "image" as const, src: img.getAttribute("src") ?? "" }));
  const out: Block[] = [];
  if (text) {
    if (tag === "h1") out.push({ type: "heading", text, level: 1 });
    else if (tag === "h2" || tag === "h3") out.push({ type: "heading", text, level: 2 });
    else if (tag === "li") out.push({ type: "paragraph", text: `• ${text}` });
    else out.push({ type: "paragraph", text });
  }
  return [...out, ...imgs.filter((i) => i.src)];
}

async function fromDocx(bookId: string, name: string, data: Buffer): Promise<Source> {
  const mammoth = (await import("mammoth")).default;
  let n = 0;
  const result = await mammoth.convertToHtml(
    { buffer: data },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const ext = image.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
        const file = await saveMedia(bookId, `docx-${newId()}-${++n}.${ext}`, await image.readAsBuffer());
        return { src: file };
      }),
    },
  );
  const root = parseHtml(result.value);
  const blocks: Block[] = [];
  for (const el of root.childNodes as HTMLElement[]) {
    if (!el.tagName) continue;
    if (el.tagName.toLowerCase() === "ul" || el.tagName.toLowerCase() === "ol") {
      for (const li of el.querySelectorAll("li")) blocks.push(...blockFromElement(li));
    } else blocks.push(...blockFromElement(el));
  }
  if (!blocks.length) throw new Error("El documento de Word está vacío.");
  return { id: newId(), name: titleFromFile(name), kind: "docx", blocks, meta: { images: n } };
}

async function fromPdf(name: string, data: Buffer): Promise<Source> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const paras = paragraphsFromPdfText(text);
  if (!paras.length) throw new Error("No se pudo leer texto de este PDF. Si es un escaneo, necesita OCR antes de importarlo.");
  return {
    id: newId(),
    name: titleFromFile(name),
    kind: "pdf",
    blocks: paras.map((p) => ({ type: "paragraph", text: p })),
    meta: { pages: totalPages },
  };
}

export async function importFile(bookId: string, file: { name: string; data: Buffer }): Promise<Source> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".zip")) return fromZip(bookId, file.name, file.data);
  if (lower.endsWith(".docx")) return fromDocx(bookId, file.name, file.data);
  if (lower.endsWith(".pdf")) return fromPdf(file.name, file.data);
  if (lower.endsWith(".doc")) throw new Error("Los .doc antiguos no se pueden leer. Guárdalo como .docx desde Word y vuelve a subirlo.");
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const raw = file.data.toString("utf8");
    if (looksLikeWhatsApp(raw)) return chatSource(file.name, raw);
    return { id: newId(), name: titleFromFile(file.name), kind: "txt", blocks: parsePlainText(raw), meta: {} };
  }
  throw new Error(`No se puede importar «${file.name}». Formatos admitidos: chat de WhatsApp (.txt o .zip), .docx, .pdf y .txt.`);
}

export function importPasted(text: string, title?: string): Source {
  if (looksLikeWhatsApp(text)) return { ...chatSource(title ?? "Chat", text), name: title || "Chat" };
  return { id: newId(), name: title || "Texto pegado", kind: "texto", blocks: parsePlainText(text), meta: {} };
}
