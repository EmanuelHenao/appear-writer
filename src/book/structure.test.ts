import { describe, expect, it } from "vitest";
import { parseWhatsApp } from "@/import/whatsapp";
import { parsePlainText } from "@/import/text";
import type { Source } from "./model";
import { suggestedBookOptions } from "./options";
import { buildChapters, formatDate, monthTitle } from "./structure";

const chat = parseWhatsApp(`2/3/24, 08:12 - Ana: Buenos días.
31/3/24, 21:00 - Emanuel: Fin de marzo.
14/4/24, 23:41 - Ana: ¿Sigues despierta?`);

const chatSource: Source = {
  id: "c1",
  name: "Ana",
  kind: "whatsapp",
  blocks: chat.blocks,
  meta: { messages: 3, firstDate: "2022-03-02T08:12:00", lastDate: "2024-04-14T23:41:00" },
};

const prose: Source = { id: "p1", name: "Diario", kind: "txt", blocks: parsePlainText("Intro.\n\n# Uno\n\nTexto uno.\n\n# Dos\n\nTexto dos."), meta: {} };

describe("opciones sugeridas", () => {
  it("un chat sugiere mensajes seguidos, capítulos por mes y título con el nombre", () => {
    const o = suggestedBookOptions([chatSource]);
    expect(o.content.onePerPage).toBe(false);
    expect(o.content.chaptersByMonth).toBe(true);
    expect(o.cover.title).toBe("Conversaciones con Ana");
    expect(o.cover.subtitle).toBe("2022 – 2024");
    expect(Object.values(o.ai).every((v) => v === false)).toBe(true);
  });

  it("un texto sugiere maquetación corrida", () => {
    expect(suggestedBookOptions([prose]).content.onePerPage).toBe(false);
  });
});

describe("capítulos", () => {
  it("agrupa un chat por mes con resumen", () => {
    const o = suggestedBookOptions([chatSource]);
    const ch = buildChapters([chatSource], { ...o, content: { ...o.content, chapterRule: "mes" } });
    expect(ch.map((c) => c.title)).toEqual(["Marzo de 2024", "Abril de 2024"]);
    expect(ch[0].subtitle).toBe("2 mensajes · del 2 al 31 de marzo");
    expect(ch[1].subtitle).toBe("1 mensaje · el 14 de abril");
  });

  it("corta un texto por sus títulos de nivel 1", () => {
    const ch = buildChapters([prose], suggestedBookOptions([prose]));
    expect(ch.map((c) => c.title)).toEqual(["Diario", "Uno", "Dos"]);
  });

  it("solo aplica lo de la IA si su casilla está marcada", () => {
    const o = suggestedBookOptions([prose]);
    const ai = { chapterTitles: { "p1:h1": "El comienzo" }, corrections: { "p1:2": "Texto uno, corregido." } };
    expect(buildChapters([prose], o, ai)[1].title).toBe("Uno");
    const on = { ...o, ai: { ...o.ai, chapters: true, spelling: true } };
    const ch = buildChapters([prose], on, ai);
    expect(ch[1].title).toBe("El comienzo");
    expect(ch[1].subtitle).toBe("Uno");
    expect(ch[1].blocks[0]).toMatchObject({ text: "Texto uno, corregido." });
  });

  it("formatea fechas en español", () => {
    expect(monthTitle("2024-03")).toBe("Marzo de 2024");
    expect(formatDate("2024-03-14T23:41:00", true)).toBe("14 mar 2024 · 23:41");
    expect(formatDate("2024-03-14T23:41:00", false)).toBe("14 mar 2024");
  });
});

describe("reglas de capítulos", () => {
  const long = parseWhatsApp(`2/3/23, 08:12 - Ana: Hola.
5/3/23, 09:00 - Emanuel: ¿Qué tal?
30/3/23, 21:00 - Ana: Volví.
2/1/24, 10:00 - Emanuel: Feliz año.`);
  const src: Source = { ...chatSource, blocks: long.blocks, meta: { messages: 4, firstDate: "2023-03-02T08:12:00", lastDate: "2024-01-02T10:00:00" } };
  const withRule = (rule: "mes" | "anio" | "silencio" | "ninguno", silenceDays = 14) => {
    const o = suggestedBookOptions([src]);
    return buildChapters([src], { ...o, content: { ...o.content, chapterRule: rule, silenceDays } });
  };

  it("sugiere por año si el chat dura más de dos años, si no por mes", () => {
    expect(suggestedBookOptions([chatSource]).content.chapterRule).toBe("anio");
    expect(suggestedBookOptions([src]).content.chapterRule).toBe("mes");
  });

  it("por año agrupa y resume los meses", () => {
    const ch = withRule("anio");
    expect(ch.map((c) => c.title)).toEqual(["2023", "2024"]);
    expect(ch[0].subtitle).toBe("3 mensajes · en marzo");
  });

  it("por silencios corta tras los días elegidos y lo dice", () => {
    const ch = withRule("silencio", 14);
    expect(ch).toHaveLength(3);
    expect(ch[0].title).toBe("Del 2 al 5 de marzo de 2023");
    expect(ch[1].subtitle).toBe("1 mensaje · tras 25 días de silencio");
    expect(ch[2].title).toBe("2 de enero de 2024");
    expect(withRule("silencio", 60)).toHaveLength(2);
  });

  it("sin capítulos deja todo junto y los libros de antes siguen con chaptersByMonth", () => {
    expect(withRule("ninguno")).toHaveLength(1);
    const o = suggestedBookOptions([src]);
    const old = { ...o, content: { ...o.content, chapterRule: undefined, chaptersByMonth: true } };
    expect(buildChapters([src], old).map((c) => c.title)).toEqual(["Marzo de 2023", "Enero de 2024"]);
  });
});

describe("correcciones de ortografía", () => {
  it("se aplican al maquetar sin cambiar la fuente", () => {
    const o = suggestedBookOptions([prose]);
    const ch = buildChapters([prose], { ...o, fixes: { texto: "Texto corregido" } });
    const p = ch[1].blocks.find((b) => b.type === "paragraph");
    expect(p && "text" in p ? p.text : "").toBe("Texto corregido uno.");
    expect(prose.blocks.some((b) => b.type === "paragraph" && b.text === "Texto uno.")).toBe(true);
  });
});
