import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildProposals, randomDesign, suggestedImageOptions, suggestedPatternOptions } from "./compose";
import { readText } from "./fit";
import { getPalette } from "./palettes";
import { makePattern, PATTERN_IDS, PatternLayer, splitEmojis } from "./patterns";

const opts = (text = "No esperes el momento perfecto. Créalo.") => suggestedImageOptions(readText(text));

describe("patrones generativos", () => {
  it("la misma semilla dibuja lo mismo y otra semilla cambia", () => {
    const p = makePattern({ ...suggestedPatternOptions(), kinds: ["flujo"] }, 42);
    const draw = (seed: number) =>
      renderToStaticMarkup(<PatternLayer pattern={{ ...p, seed }} palette={getPalette("pop")} width={1080} height={1350} />);
    expect(draw(42)).toBe(draw(42));
    expect(draw(42)).not.toBe(draw(43));
  });

  it("cada tipo produce algo", () => {
    for (const id of PATTERN_IDS) {
      const html = renderToStaticMarkup(
        <PatternLayer pattern={{ seed: 7, layers: [id], intensity: "media", scale: 1, emojis: "🌿" }} palette={getPalette("tierra")} width={1080} height={1080} />,
      );
      expect(html.length, id).toBeGreaterThan(400);
    }
  });

  it("solo usa los tipos marcados, uno o varios combinados", () => {
    const base = { ...suggestedPatternOptions(), kinds: ["truchet", "ondas", "ascii-ruido"] as const };
    for (let s = 0; s < 30; s++) {
      const one = makePattern({ ...base, kinds: [...base.kinds], combine: false }, s);
      expect(one.layers).toHaveLength(1);
      expect(base.kinds).toContain(one.layers[0]);
      const many = makePattern({ ...base, kinds: [...base.kinds], combine: true, layers: 3 }, s);
      expect(new Set(many.layers).size).toBe(3);
    }
  });

  it("los emojis del texto se sugieren para los patrones", () => {
    expect(splitEmojis("Hola 🌻 mundo ❤️ 👩‍👩‍👧")).toEqual(["🌻", "❤️", "👩‍👩‍👧"]);
    const o = suggestedPatternOptions("Buenos días ☀️🌻");
    expect(o.emojis).toBe("☀️🌻");
    expect(o.kinds).toContain("emoji-rejilla");
    expect(suggestedPatternOptions("Sin emojis").kinds).not.toContain("emoji-rejilla");
  });

  it("las propuestas con fondo patrón llevan su patrón y las plantillas guardadas van primero", () => {
    const o = { ...opts(), backgrounds: ["patron" as const] };
    const saved = { templateId: "minimal-marco", paletteId: "vino", font: null, background: "plano" as const };
    const list = buildProposals(o, 0, 4, [saved]);
    expect(list[0]).toEqual(saved);
    for (const d of list.slice(1)) expect(d.pattern?.layers.length).toBe(1);
    expect(buildProposals(o, 1, 4, [saved]).some((d) => d.templateId === "minimal-marco" && d.paletteId === "vino")).toBe(false);
  });

  it("el diseño aleatorio respeta estilos, fondos, paleta y letra fijados", () => {
    const o = { ...opts(), families: ["minimal" as const], backgrounds: ["patron" as const], palette: "salvia", font: "syne" };
    for (let s = 0; s < 40; s++) {
      const d = randomDesign(o, s);
      expect(d.templateId.startsWith("minimal-")).toBe(true);
      expect(d.paletteId).toBe("salvia");
      expect(d.font).toBe("syne");
      expect(d.background).toBe("patron");
      expect(o.patterns.kinds).toContain(d.pattern!.layers[0]);
    }
  });
});
