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
  it("un chat sugiere un mensaje por página, capítulos por mes y título con el nombre", () => {
    const o = suggestedBookOptions([chatSource]);
    expect(o.content.onePerPage).toBe(true);
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
    const ch = buildChapters([chatSource], suggestedBookOptions([chatSource]));
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
