import { describe, expect, it } from "vitest";
import { chatNameFromFile, looksLikeWhatsApp, parseWhatsApp } from "./whatsapp";

const ANDROID_ES = `14/3/24, 23:39 - Los mensajes y las llamadas están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos ni escucharlos.
14/3/24, 23:41 - Ana: ¿Sigues despierta? Acabo de ver la luna más grande del año y me acordé de ti.
14/3/24, 23:43 - Emanuel: Sí. Me asomé a la ventana justo ahora.
Tienes razón, está enorme.
15/3/24, 0:02 - Ana: IMG-20240315-WA0001.jpg (archivo adjunto)
Mira
15/3/24, 0:03 - Emanuel: <Multimedia omitido>
15/3/24, 0:04 - Ana: Se eliminó este mensaje
15/3/24, 0:05 - Ana: Buenas noches <Se editó este mensaje.>`;

const IOS_ES = `[2/3/24, 08:12:05] Ana: Buenos días. Hoy salió el sol.
[2/3/24, 08:15:40] Emanuel: ‎<adjunto: 00000012-PHOTO-2024-03-02-08-15-40.jpg>
[2/3/24, 08:16:01] Emanuel: ¿Desayunamos el sábado?`;

const ANDROID_EN_12H = `3/14/24, 11:41 PM - Ana: Are you awake?
3/14/24, 11:43 PM - Sam: Yes
3/15/24, 12:05 AM - Ana: Good night`;

const ANDROID_ES_12H = `14/03/2024, 11:41 p. m. - Ana: ¿Sigues despierta?
15/03/2024, 12:05 a. m. - Ana: Buenas noches`;

describe("chat de WhatsApp", () => {
  it("lee Android en español con varias líneas, adjuntos y mensajes del sistema", () => {
    const r = parseWhatsApp(ANDROID_ES);
    expect(r.participants).toEqual(["Ana", "Emanuel"]);
    expect(r.blocks).toHaveLength(4);
    expect(r.blocks[0]).toMatchObject({ author: "Ana", date: "2024-03-14T23:41:00" });
    expect(r.blocks[1].text).toBe("Sí. Me asomé a la ventana justo ahora.\nTienes razón, está enorme.");
    expect(r.blocks[2]).toMatchObject({ media: ["IMG-20240315-WA0001.jpg"], text: "Mira", date: "2024-03-15T00:02:00" });
    expect(r.blocks[3].text).toBe("Buenas noches");
    // Cifrado, multimedia omitida y mensaje eliminado.
    expect(r.skipped).toBe(3);
  });

  it("lee iOS con segundos y adjuntos entre <>", () => {
    const r = parseWhatsApp(IOS_ES);
    expect(r.blocks).toHaveLength(3);
    expect(r.blocks[1]).toMatchObject({ author: "Emanuel", text: "", media: ["00000012-PHOTO-2024-03-02-08-15-40.jpg"] });
    expect(r.blocks[0].date).toBe("2024-03-02T08:12:05");
  });

  it("detecta mes/día y la hora de 12 h en inglés", () => {
    const r = parseWhatsApp(ANDROID_EN_12H);
    expect(r.blocks.map((b) => b.date)).toEqual(["2024-03-14T23:41:00", "2024-03-14T23:43:00", "2024-03-15T00:05:00"]);
  });

  it("entiende «p. m.» con espacios finos", () => {
    const r = parseWhatsApp(ANDROID_ES_12H.replace(/ m\./g, " m."));
    expect(r.blocks.map((b) => b.date)).toEqual(["2024-03-14T23:41:00", "2024-03-15T00:05:00"]);
  });

  it("reconoce un chat y saca el nombre del archivo", () => {
    expect(looksLikeWhatsApp(ANDROID_ES)).toBe(true);
    expect(looksLikeWhatsApp("Había una vez un poema.\nSin fechas.")).toBe(false);
    expect(chatNameFromFile("Chat de WhatsApp con Ana.txt")).toBe("Ana");
    expect(chatNameFromFile("WhatsApp Chat with Sam.zip")).toBe("Sam");
  });
});
