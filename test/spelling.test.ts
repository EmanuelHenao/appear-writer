import { describe, expect, it } from "vitest";
import { applyFixes } from "@/book/fixes";
import { checkSpelling } from "@/lib/spelling";

describe("ortografía sin IA", () => {
  it("propone tildes, jerga y desconocidas, sin tocar nombres ni risas", async () => {
    const issues = await checkSpelling(
      [
        "Hoy escuche una cancion y me acorde de ti, Ana.",
        "jajaja q bonito dia. Mañana vamos con Lucía xq hace sol.",
        "Te mando la cancion otra vez, qeria que la oyeras.",
      ],
      ["Ana"],
    );
    const by = Object.fromEntries(issues.map((i) => [i.word, i]));
    expect(by.cancion).toMatchObject({ kind: "tilde", count: 2, suggestions: ["canción"] });
    expect(by.dia.suggestions[0]).toBe("día");
    expect(by.q.kind).toBe("jerga");
    expect(by.xq.suggestions).toContain("porque");
    expect(by.qeria?.kind).toBe("otra");
    expect(by.jajaja).toBeUndefined();
    expect(by.ana).toBeUndefined();
    expect(by["lucía"]).toBeUndefined();
    // Lo más repetido va primero.
    expect(issues[0].word).toBe("cancion");
  }, 20_000);

  it("aplica las correcciones por palabra completa y respeta mayúsculas", () => {
    const fixes = { cancion: "canción", q: "que", dia: "día" };
    expect(applyFixes("Cancion de q dia. CANCION. Canciones y diario.", fixes)).toBe("Canción de que día. CANCIÓN. Canciones y diario.");
    expect(applyFixes("sin cambios", {})).toBe("sin cambios");
  });
});
