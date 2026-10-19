import { describe, expect, it } from "vitest";
import { captionVariants, keywords, templateCaption, templateHashtags } from "./caption";

const TEXT = "No esperes el momento perfecto. Créalo. El momento perfecto es el que decides empezar.";

describe("texto de publicación sin IA", () => {
  it("saca palabras clave sin palabras vacías y sin tildes", () => {
    const k = keywords(TEXT);
    // Las que más se repiten van primero; en empate, la más larga.
    expect(k.slice(0, 2)).toEqual(["perfecto", "momento"]);
    expect(k).toContain("crealo");
    expect(k).not.toContain("el");
    expect(k.every((w) => !/[áéíóú]/.test(w))).toBe(true);
  });

  it("los hashtags llevan # y no se repiten", () => {
    const tags = templateHashtags(TEXT);
    expect(tags.every((t) => t.startsWith("#"))).toBe(true);
    expect(new Set(tags).size).toBe(tags.length);
    expect(tags.length).toBeLessThanOrEqual(8);
  });

  it("es determinista y cada versión cambia el cierre", () => {
    const a = templateCaption(TEXT, { style: "reflexion", variant: 0 });
    expect(templateCaption(TEXT, { style: "reflexion", variant: 0 })).toEqual(a);
    expect(templateCaption(TEXT, { style: "reflexion", variant: 1 }).texto).not.toBe(a.texto);
    expect(templateCaption(TEXT, { style: "reflexion", variant: captionVariants("reflexion") }).texto).toBe(a.texto);
    expect(a.texto.startsWith(TEXT)).toBe(true);
  });

  it("añade la firma y recorta los textos largos", () => {
    const c = templateCaption(TEXT, { style: "breve", variant: 0, handle: "doxaki" });
    expect(c.texto.endsWith("— @doxaki")).toBe(true);
    const long = templateCaption(`${"Una frase larga que sigue. ".repeat(12)}`, { style: "guardar", variant: 0 });
    expect(long.texto.split("\n\n")[0].length).toBeLessThanOrEqual(221);
  });
});
