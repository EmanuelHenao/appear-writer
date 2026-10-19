import { describe, expect, it } from "vitest";
import { parseWhatsApp } from "@/import/whatsapp";
import { applyStyle, emptyEdits, hasFormat, normalizeRuns, rangeHas, runsToPlain, setBlockEdit, type Run } from "./edits";
import type { Source } from "./model";
import { suggestedBookOptions } from "./options";
import { buildChapters } from "./structure";
import { suggestEdits } from "./suggest";

describe("texto con formato", () => {
  const base: Run[] = [{ t: "Llovió todo el día" }];

  it("aplica negrita a una palabra sin tocar el resto", () => {
    const r = applyStyle(base, 7, 11, { b: true });
    expect(r).toEqual([{ t: "Llovió " }, { t: "todo", b: true }, { t: " el día" }]);
    expect(runsToPlain(r)).toBe("Llovió todo el día");
    expect(rangeHas(r, 7, 11, "b")).toBe(true);
    expect(rangeHas(r, 0, 11, "b")).toBe(false);
  });

  it("sin selección, el estilo va a todo el mensaje; quitarlo une los tramos", () => {
    const r = applyStyle(applyStyle(base, 7, 11, { b: true }), 0, 0, { i: true, font: "lora" });
    expect(r.every((x) => x.i && x.font === "lora")).toBe(true);
    const back = applyStyle(r, 0, 0, { b: undefined, i: undefined, font: undefined });
    expect(back).toEqual(base);
    expect(hasFormat(back)).toBe(false);
  });

  it("normaliza tramos vacíos y contiguos iguales", () => {
    expect(normalizeRuns([{ t: "" }, { t: "a", b: true }, { t: "b", b: true }, { t: "c", b: false }])).toEqual([{ t: "ab", b: true }, { t: "c" }]);
  });

  it("un ajuste vacío desaparece al restablecer", () => {
    let e = setBlockEdit(emptyEdits(), "c1:0", { hidden: true });
    expect(e.blocks["c1:0"]).toEqual({ hidden: true });
    e = setBlockEdit(e, "c1:0", { hidden: undefined });
    expect(e.blocks["c1:0"]).toBeUndefined();
  });
});

const chat = parseWhatsApp(`2/3/22, 08:12 - Ana: Buenos días, ¿empezamos este chat?
2/3/22, 08:13 - Emanuel: jajaja
2/3/22, 08:14 - Ana: ok
2/3/22, 08:15 - Emanuel: 👍
14/2/23, 10:00 - Ana: Feliz San Valentín, aunque estemos lejos.
2/3/23, 09:00 - Emanuel: Hoy hace un año del primer mensaje.
5/3/23, 09:00 - Ana: Otra cosa.`);
const src: Source = { id: "c1", name: "Ana", kind: "whatsapp", blocks: chat.blocks, meta: {} };
const o = suggestedBookOptions([src]);
const opts = { ...o, content: { ...o.content, chapterRule: "anio" as const } };

describe("ediciones al maquetar", () => {
  it("oculta mensajes, cambia el texto y quita fotos sin tocar la fuente", () => {
    let e = setBlockEdit(emptyEdits(), "c1:1", { hidden: true });
    e = setBlockEdit(e, "c1:0", { runs: [{ t: "Hola, " }, { t: "empezamos", b: true }] });
    const blocks = buildChapters([src], opts, {}, e).flatMap((c) => c.blocks);
    expect(blocks.some((b) => b.key === "c1:1")).toBe(false);
    const first = blocks.find((b) => b.key === "c1:0");
    expect(first?.type === "message" && first.text).toBe("Hola, empezamos");
    expect(src.blocks[0].type === "message" && src.blocks[0].text).toContain("Buenos días");
  });

  it("empieza un capítulo donde se pide y coloca las páginas añadidas", () => {
    let e = setBlockEdit(emptyEdits(), "c1:2", { chapter: { title: "La mañana" } });
    e = { ...e, inserts: [{ id: "s1", at: "c1:2", side: "antes", kind: "separador", title: "Pausa" }, { id: "b1", at: "c1:3", side: "despues", kind: "blanco" }] };
    const ch = buildChapters([src], opts, {}, e);
    expect(ch.map((c) => c.title)).toEqual(["2022", "La mañana", "2023"]);
    expect(ch[0].blocks.map((b) => b.key)).toEqual(["c1:0", "c1:1", "ins:s1"]);
    expect(ch[1].blocks.map((b) => b.key)).toEqual(["c1:2", "c1:3", "ins:b1"]);
  });

  it("un corte en el primer mensaje renombra el capítulo en vez de dejar uno vacío", () => {
    const e = setBlockEdit(emptyEdits(), "c1:0", { chapter: { title: "Cómo empezó", subtitle: "marzo" } });
    const ch = buildChapters([src], opts, {}, e);
    expect(ch[0].title).toBe("Cómo empezó");
    expect(ch[0].subtitle).toBe("marzo");
    expect(ch).toHaveLength(2);
  });

  it("las correcciones de ortografía también se aplican al texto editado", () => {
    const e = setBlockEdit(emptyEdits(), "c1:6", { runs: [{ t: "otra ", b: true }, { t: "cosa q digo" }] });
    const blocks = buildChapters([src], { ...opts, fixes: { q: "que" } }, {}, e).flatMap((c) => c.blocks);
    const b = blocks.find((x) => x.key === "c1:6");
    expect(b?.type === "message" && b.text).toBe("otra cosa que digo");
    expect(b?.edit?.runs?.[1].t).toBe("cosa que digo");
  });
});

describe("sugerencias sin IA", () => {
  it("propone ocultar risas, monosílabos y emojis, y destacar el primero y los aniversarios", () => {
    const s = suggestEdits([src], emptyEdits());
    const by = Object.fromEntries(s.map((x) => [x.id, x]));
    expect(by.risas.keys).toEqual(["c1:1"]);
    expect(by.cortas.keys).toEqual(["c1:2"]);
    expect(by.emojis.keys).toEqual(["c1:3"]);
    expect(by.emojis.suggested).toBe(true);
    expect(by.risas.suggested).toBe(false);
    expect(by.primero.keys).toEqual(["c1:0"]);
    expect(by.aniversarios.keys).toEqual(["c1:5"]);
    expect(by.fechas.keys).toEqual(["c1:4"]);
  });

  it("no vuelve a proponer lo que ya está oculto", () => {
    const s = suggestEdits([src], setBlockEdit(emptyEdits(), "c1:1", { hidden: true }));
    expect(s.find((x) => x.id === "risas")).toBeUndefined();
  });
});
