import JSZip from "jszip";
import { getBrowser } from "@/lib/render/browser";

// Archivos de prueba generados al vuelo: así no hay binarios en el repo.

export const CHAT_TXT = `14/3/24, 23:39 - Los mensajes y las llamadas están cifrados de extremo a extremo.
14/3/24, 23:41 - Ana: ¿Sigues despierta? Acabo de ver la luna más grande del año y me acordé de ti.
14/3/24, 23:43 - Emanuel: Sí. Me asomé a la ventana justo ahora.
Tienes razón, está enorme.
15/3/24, 0:02 - Ana: IMG-20240315-WA0001.jpg (archivo adjunto)
Mira qué foto
2/4/24, 8:12 - Emanuel: Buenos días. ¿Desayunamos el sábado?
2/4/24, 8:15 - Ana: IMG-20240402-WA0002.png (archivo adjunto)`;

export async function tinyPng(color = "#d96b4b"): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 120, height: 90 } });
  await page.setContent(`<body style="margin:0;background:${color}"></body>`);
  const png = await page.screenshot({ type: "png" });
  await page.close();
  return png;
}

export async function chatZip(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("_chat.txt", CHAT_TXT);
  zip.file("IMG-20240315-WA0001.jpg", await tinyPng("#2f6f6a"));
  zip.file("IMG-20240402-WA0002.png", await tinyPng("#d96b4b"));
  zip.file("AUD-20240402-WA0003.opus", Buffer.from("audio"));
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Un .docx mínimo con un título, dos párrafos y una lista. */
export async function minimalDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  const p = (text: string, style?: string) =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p("Poemas de invierno", "Heading1")}${p("La lluvia golpea el cristal y yo pienso en ti.")}${p("Casa es cuando llego y ya me estabas esperando.")}${p("Segunda parte", "Heading1")}${p("El sol volvió el martes.")}</w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function minimalPdf(): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const para = "Este es un párrafo de prueba que el PDF reparte en varias líneas para comprobar que el importador las une otra vez correctamente. ".repeat(3);
  await page.setContent(`<body style="font: 14px Georgia; width: 500px"><p>${para}</p><p>${para}</p></body>`);
  const pdf = await page.pdf({ format: "A5" });
  await page.close();
  return Buffer.from(pdf);
}
