import { describe, expect, it } from "vitest";
import { paragraphsFromPdfText, parsePlainText } from "./text";

describe("texto plano", () => {
  it("separa párrafos y respeta los versos", () => {
    const blocks = parsePlainText("Casa\n\nNo es el techo\nni las paredes.\n\nEs la taza que dejas.");
    expect(blocks).toEqual([
      { type: "paragraph", text: "Casa" },
      { type: "paragraph", text: "No es el techo\nni las paredes." },
      { type: "paragraph", text: "Es la taza que dejas." },
    ]);
  });

  it("reconoce títulos en Markdown y «Capítulo»", () => {
    const blocks = parsePlainText("# Mi diario\n\nCapítulo 1\n\nHoy llovió.\n\n## Martes\nSalió el sol.");
    expect(blocks).toEqual([
      { type: "heading", text: "Mi diario", level: 1 },
      { type: "heading", text: "Capítulo 1", level: 1 },
      { type: "paragraph", text: "Hoy llovió." },
      { type: "heading", text: "Martes", level: 2 },
      { type: "paragraph", text: "Salió el sol." },
    ]);
  });
});

describe("texto de PDF", () => {
  it("une líneas en párrafos, corrige guiones y quita números de página", () => {
    const page1 =
      "Este es un párrafo bastante largo que el PDF partió en varias líneas por-\n" +
      "que así lo maquetó el programa original de quien lo escribió hace años\n" +
      "y termina aquí.\n" +
      "Segundo párrafo que también es largo y ocupa una línea completa del PDF\n" +
      "y acaba pronto.\n" +
      "12";
    expect(paragraphsFromPdfText([page1])).toEqual([
      "Este es un párrafo bastante largo que el PDF partió en varias líneas porque así lo maquetó el programa original de quien lo escribió hace años y termina aquí.",
      "Segundo párrafo que también es largo y ocupa una línea completa del PDF y acaba pronto.",
    ]);
  });
});
