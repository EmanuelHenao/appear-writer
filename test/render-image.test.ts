import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { composeSlides, suggestedImageOptions } from "@/design/compose";
import { readText } from "@/design/fit";
import { PATTERN_IDS } from "@/design/patterns";
import { TEMPLATES } from "@/design/templates";
import { getBrowser } from "@/lib/render/browser";
import { renderSlidesPng } from "@/lib/render/image";

export function pngSize(buf: Buffer): { w: number; h: number } {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const OUT = process.env.RENDER_OUT;

async function save(name: string, buf: Buffer) {
  if (!OUT) return;
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, name), buf);
}

describe("render de imágenes con Chromium", () => {
  afterAll(async () => {
    (await getBrowser()).close();
  });

  it("cada plantilla produce un PNG 4:5 a doble resolución", async () => {
    const text = "No esperes el momento perfecto. Créalo.";
    const opts = suggestedImageOptions(readText(text), { handle: "@tuusuario" });
    const slides = TEMPLATES.flatMap((t) =>
      composeSlides({
        text,
        options: opts,
        design: { templateId: t.id, paletteId: t.defaultPalette, font: null, background: "estilo" },
        brand: { handle: "@tuusuario", colors: { bg: "#000000", fg: "#FFFFFF", accent: "#FF0000" }, font: "syne" },
      }),
    );
    const pngs = await renderSlidesPng(slides, true);
    expect(pngs).toHaveLength(TEMPLATES.length);
    for (const [i, png] of pngs.entries()) {
      expect(pngSize(png)).toEqual({ w: 2160, h: 2700 });
      await save(`${TEMPLATES[i].id}.png`, png);
    }
  });

  it("cada patrón generativo se dibuja detrás del texto", async () => {
    const text = "Hoy elijo empezar 🌿✨";
    const opts = suggestedImageOptions(readText(text));
    const tpl = ["bold-poster", "vivo-bloques", "minimal-serif", "arte-collage", "bold-noir", "minimal-centro"];
    const pals = ["energia", "pop", "salvia", "kraft", "noir", "tinta", "vino", "atardecer"];
    const slides = PATTERN_IDS.flatMap((id, i) =>
      composeSlides({
        text,
        options: opts,
        design: {
          templateId: tpl[i % tpl.length],
          paletteId: pals[i % pals.length],
          font: null,
          background: "patron",
          pattern: { seed: 11 + i, layers: [id], intensity: "media", scale: 1, emojis: "🌿✨" },
        },
      }),
    );
    const combo = composeSlides({
      text,
      options: opts,
      design: { templateId: "bold-poster", paletteId: "pop", font: null, background: "patron", pattern: { seed: 5, layers: ["topografico", "ascii-ruido", "emoji-lluvia"], intensity: "fuerte", scale: 1, emojis: "🌿✨" } },
    });
    const pngs = await renderSlidesPng([...slides, ...combo], false);
    expect(pngs).toHaveLength(PATTERN_IDS.length + 1);
    for (const [i, png] of pngs.entries()) await save(`patron-${PATTERN_IDS[i] ?? "combinado"}.png`, png);
  });

  it("un carrusel produce una imagen por diapositiva", async () => {
    const text =
      "Un día vas a mirar atrás y entender que cada noche difícil te estaba enseñando algo. Cada puerta cerrada y cada adiós te estaban enseñando a llegar aquí. No fue suerte. Fuiste tú, eligiendo seguir, incluso cuando nadie lo veía.";
    const opts = { ...suggestedImageOptions(readText(text)), format: "carrusel" as const, carouselAspect: "1:1" as const };
    const slides = composeSlides({
      text,
      options: opts,
      design: { templateId: "arte-acuarela", paletteId: "acuarela", font: null, background: "estilo" },
    });
    const pngs = await renderSlidesPng(slides, false);
    expect(pngs.length).toBe(slides.length);
    expect(pngs.length).toBeGreaterThan(1);
    for (const [i, png] of pngs.entries()) {
      expect(pngSize(png)).toEqual({ w: 1080, h: 1080 });
      await save(`carrusel-${i + 1}.png`, png);
    }
  });

  it("una historia 9:16 mide 2160×3840", async () => {
    const text = "Lo que hoy te parece un desvío, mañana será el camino.";
    const opts = { ...suggestedImageOptions(readText(text)), format: "9:16" as const };
    const slides = composeSlides({
      text,
      options: opts,
      design: { templateId: "vivo-atardecer", paletteId: "atardecer", font: null, background: "estilo" },
    });
    const [png] = await renderSlidesPng(slides, true);
    expect(pngSize(png)).toEqual({ w: 2160, h: 3840 });
    await save("historia.png", png);
  });
});
