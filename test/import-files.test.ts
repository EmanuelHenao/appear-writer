import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { importFile, importPasted } from "@/import";
import { getBrowser } from "@/lib/render/browser";
import { CHAT_TXT, chatZip, minimalDocx, minimalPdf } from "./fixtures";

const DATA = path.resolve("test-results/data-import");

describe("importar archivos", () => {
  beforeAll(async () => {
    process.env.DATA_DIR = DATA;
    await rm(DATA, { recursive: true, force: true });
  });
  afterAll(async () => {
    (await getBrowser()).close();
  });

  it("un ZIP de WhatsApp copia solo las fotos que el chat menciona", async () => {
    const s = await importFile("libro1", { name: "Chat de WhatsApp con Ana.zip", data: await chatZip() });
    expect(s.kind).toBe("whatsapp");
    expect(s.name).toBe("Ana");
    expect(s.meta.messages).toBe(5);
    expect(s.meta.images).toBe(2);
    const media = await readdir(path.join(DATA, "books", "libro1", "media"));
    expect(media.sort()).toEqual(["IMG-20240315-WA0001.jpg", "IMG-20240402-WA0002.png"]);
  });

  it("un .txt de WhatsApp se reconoce como chat", async () => {
    const s = await importFile("libro1", { name: "Chat de WhatsApp con Ana.txt", data: Buffer.from(CHAT_TXT) });
    expect(s.kind).toBe("whatsapp");
    expect(s.meta.participants).toEqual(["Ana", "Emanuel"]);
  });

  it("un .docx conserva títulos y párrafos", async () => {
    const s = await importFile("libro1", { name: "Poemas.docx", data: await minimalDocx() });
    expect(s.kind).toBe("docx");
    expect(s.blocks[0]).toEqual({ type: "heading", text: "Poemas de invierno", level: 1 });
    expect(s.blocks.filter((b) => b.type === "paragraph")).toHaveLength(3);
  });

  it("un PDF se convierte en párrafos", async () => {
    const s = await importFile("libro1", { name: "Diario.pdf", data: await minimalPdf() });
    expect(s.kind).toBe("pdf");
    expect(s.meta.pages).toBeGreaterThanOrEqual(1);
    const paras = s.blocks.filter((b) => b.type === "paragraph");
    expect(paras.length).toBeGreaterThanOrEqual(1);
    expect(paras.map((p) => (p.type === "paragraph" ? p.text : "")).join(" ")).toContain("importador las une otra vez");
  });

  it("rechaza formatos no admitidos con un mensaje útil", async () => {
    await expect(importFile("libro1", { name: "viejo.doc", data: Buffer.from("x") })).rejects.toThrow(/\.docx/);
    await expect(importFile("libro1", { name: "foto.heic", data: Buffer.from("x") })).rejects.toThrow(/Formatos admitidos/);
  });

  it("el texto pegado se divide en párrafos", () => {
    const s = importPasted("Uno.\n\nDos.", "Notas");
    expect(s).toMatchObject({ kind: "texto", name: "Notas" });
    expect(s.blocks).toHaveLength(2);
  });
});
