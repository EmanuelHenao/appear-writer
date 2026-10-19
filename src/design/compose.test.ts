import { describe, expect, it } from "vitest";
import { buildProposals, composeSlides, suggestedImageOptions } from "./compose";
import { readText } from "./fit";
import { getTemplate } from "./templates";

const frase = "No esperes el momento perfecto. Créalo.";

describe("propuestas", () => {
  it("cuatro propuestas de familias distintas por defecto", () => {
    const opts = suggestedImageOptions(readText(frase));
    const ps = buildProposals(opts);
    expect(ps).toHaveLength(4);
    expect(new Set(ps.map((p) => getTemplate(p.templateId).family)).size).toBe(4);
  });

  it("con una sola familia usa sus plantillas y varía la paleta", () => {
    const opts = { ...suggestedImageOptions(readText(frase)), families: ["minimal" as const] };
    const ps = buildProposals(opts);
    expect(ps.every((p) => getTemplate(p.templateId).family === "minimal")).toBe(true);
    expect(new Set(ps.map((p) => `${p.templateId}/${p.paletteId}`)).size).toBe(4);
  });

  it("respeta la paleta y la fuente fijadas por el usuario", () => {
    const opts = { ...suggestedImageOptions(readText(frase)), palette: "tinta", font: "fraunces" };
    for (const p of buildProposals(opts)) {
      expect(p.paletteId).toBe("tinta");
      expect(p.font).toBe("fraunces");
    }
  });

  it("«otras 4» cambia las propuestas", () => {
    const opts = suggestedImageOptions(readText(frase));
    expect(buildProposals(opts, 1)).not.toEqual(buildProposals(opts, 0));
  });
});

describe("diapositivas", () => {
  it("una frase corta es una sola imagen 1080×1350", () => {
    const opts = suggestedImageOptions(readText(frase));
    const [design] = buildProposals(opts);
    const slides = composeSlides({ text: frase, options: opts, design });
    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({ width: 1080, height: 1350, index: 1, total: 1, emphasis: ["Créalo."] });
  });

  it("un texto largo en carrusel produce varias diapositivas numeradas", () => {
    const text = Array.from({ length: 6 }, (_, i) => `Esta es la frase número ${i + 1} de un texto bastante largo para probar.`).join(" ");
    const opts = { ...suggestedImageOptions(readText(text)), format: "carrusel" as const, carouselAspect: "1:1" as const };
    const slides = composeSlides({ text, options: opts, design: buildProposals(opts)[0] });
    expect(slides.length).toBeGreaterThan(1);
    expect(slides.every((s) => s.width === 1080 && s.height === 1080)).toBe(true);
    expect(slides.map((s) => s.index)).toEqual(slides.map((_, i) => i + 1));
  });

  it("la marca solo aparece si su casilla está marcada", () => {
    const opts = suggestedImageOptions(readText(frase), { handle: "@ana" });
    const brand = { handle: "@ana", colors: { bg: "#000000", fg: "#FFFFFF", accent: "#FF0000" }, font: "syne" };
    const design = buildProposals(opts)[0];
    expect(composeSlides({ text: frase, options: opts, design, brand })[0].brand.handle).toBe("@ana");
    const off = { ...opts, brand: { ...opts.brand, handle: false } };
    expect(composeSlides({ text: frase, options: off, design, brand })[0].brand.handle).toBeUndefined();
    const pal = { ...opts, brand: { ...opts.brand, palette: true, font: true } };
    const s = composeSlides({ text: frase, options: pal, design, brand })[0];
    expect(s.palette.bg).toBe("#000000");
    expect(s.font).toBe("syne");
  });

  it("sin foto elegida el fondo de foto cae en textura", () => {
    const opts = suggestedImageOptions(readText(frase));
    const design = { ...buildProposals(opts)[0], background: "foto" as const };
    expect(composeSlides({ text: frase, options: opts, design })[0].background).toBe("textura");
    const withPhoto = composeSlides({ text: frase, options: opts, design, photo: { url: "https://x/y.jpg" } })[0];
    expect(withPhoto.background).toBe("foto");
  });
});
