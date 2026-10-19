import { describe, expect, it } from "vitest";
import {
  classifyLength,
  countWords,
  defaultEmphasis,
  readText,
  splitEmphasis,
  splitSentences,
  splitSlides,
  suggestFormat,
} from "./fit";

describe("lectura del texto", () => {
  it("clasifica una frase corta y sugiere 4:5", () => {
    const r = readText("No esperes el momento perfecto. Créalo.");
    expect(r.chars).toBe(39);
    expect(r.words).toBe(6);
    expect(r.lengthClass).toBe("corta");
    expect(r.suggestedFormat).toBe("4:5");
    expect(r.emphasis).toEqual(["Créalo."]);
  });

  it("sugiere 1:1 para frases medias largas y carrusel para textos largos", () => {
    expect(suggestFormat(100)).toBe("4:5");
    expect(suggestFormat(180)).toBe("1:1");
    expect(suggestFormat(300)).toBe("carrusel");
    expect(classifyLength(800)).toBe("muy-larga");
  });

  it("cuenta palabras con tildes, eñes y apóstrofos", () => {
    expect(countWords("¿Mañana volverás, corazón?")).toBe(3);
    expect(countWords("rock'n'roll")).toBe(1);
  });

  it("separa frases con signos de apertura en español", () => {
    expect(splitSentences("¿Sigues despierta? ¡Mira la luna! Es enorme…")).toEqual([
      "¿Sigues despierta?",
      "¡Mira la luna!",
      "Es enorme…",
    ]);
  });

  it("reparte un texto largo en diapositivas sin pasar el máximo", () => {
    const text =
      "Un día vas a mirar atrás y entender que cada noche difícil te estaba enseñando algo. " +
      "Cada puerta cerrada y cada adiós te estaban enseñando a llegar aquí. " +
      "No fue suerte. Fuiste tú, eligiendo seguir, incluso cuando nadie lo veía. " +
      "Y eso, aunque no lo creas, es lo más valiente que has hecho.";
    const slides = splitSlides(text);
    expect(slides.length).toBeGreaterThan(1);
    for (const s of slides) expect(s.length).toBeLessThanOrEqual(180);
    expect(slides.join(" ").replace(/\s+/g, " ")).toBe(text);
  });

  it("respeta los párrafos como cortes de diapositiva", () => {
    expect(splitSlides("Primera idea.\n\nSegunda idea.")).toEqual(["Primera idea.", "Segunda idea."]);
  });

  it("corta frases sin puntuación que superan el máximo", () => {
    const long = Array.from({ length: 80 }, (_, i) => `palabra${i}`).join(" ");
    const slides = splitSlides(long);
    expect(slides.length).toBeGreaterThan(1);
    for (const s of slides) expect(s.length).toBeLessThanOrEqual(180);
  });

  it("no destaca nada si la última frase es larga o solo hay una", () => {
    expect(defaultEmphasis("Una sola frase.")).toEqual([]);
    expect(defaultEmphasis("Primera. Esta última frase tiene muchas palabras.")).toEqual([]);
  });

  it("marca los segmentos destacados", () => {
    expect(splitEmphasis("No esperes. Créalo.", ["créalo."])).toEqual([
      { text: "No esperes. ", em: false },
      { text: "Créalo.", em: true },
    ]);
  });
});
