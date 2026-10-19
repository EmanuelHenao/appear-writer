import type { Block } from "@/book/model";

// Lector de chats exportados de WhatsApp (Android e iOS, en español o
// inglés, con hora de 24 h o de 12 h). El texto se conserva tal cual.

const LINE =
  /^‎?\[?(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?\s?m\.?)?\]?\s*(?:-\s+)?(.*)$/i;

const SYSTEM = [
  /cifrados de extremo a extremo/i,
  /end-to-end encrypted/i,
  /creó (el )?grupo/i,
  /created (the )?group/i,
  /cambió (el asunto|la descripción|el ícono|la imagen|su número)/i,
  /changed (the subject|this group|the group|their phone)/i,
  /se unió usando|joined using/i,
  /añadió a|added /i,
  /salió del grupo|\bleft$/i,
  /mensajes temporales|disappearing messages/i,
];

const DELETED = /^(se eliminó este mensaje\.?|eliminaste este mensaje\.?|this message was deleted\.?|you deleted this message\.?)$/i;
const EDITED = /\s*<(se editó este mensaje\.?|this message was edited)>\s*$/i;
const OMITTED = /^<?‎?(multimedia omitido|media omitted|imagen omitida|image omitted|video omitido|video omitted|audio omitido|audio omitted|sticker omitido|sticker omitted|gif omitido|gif omitted|documento omitido|document omitted)>?$/i;
const IOS_ATTACH = /^‎?<(?:adjunto|attached):\s*([^>]+)>$/i;
const ANDROID_ATTACH = /^‎?(\S+\.[a-z0-9]{2,5})\s+\((?:archivo adjunto|file attached)\)$/i;

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export interface ParsedChat {
  blocks: Extract<Block, { type: "message" }>[];
  participants: string[];
  /** Archivos adjuntos mencionados (imágenes y otros). */
  attachments: string[];
  skipped: number;
}

interface RawLine {
  a: number;
  b: number;
  y: number;
  h: number;
  min: number;
  s: number;
  ampm: string | undefined;
  rest: string;
}

function clean(text: string): string {
  return text.replace(/[  ]/g, " ").replace(/‎|‏/g, "");
}

export function parseWhatsApp(raw: string): ParsedChat {
  const lines = clean(raw.replace(/^﻿/, "")).split(/\r?\n/);
  const heads: (RawLine | null)[] = lines.map((l) => {
    const m = l.match(LINE);
    if (!m) return null;
    return {
      a: +m[1],
      b: +m[2],
      y: +m[3],
      h: +m[4],
      min: +m[5],
      s: m[6] ? +m[6] : 0,
      ampm: m[7]?.toLowerCase().replace(/[.\s]/g, ""),
      rest: m[8],
    };
  });

  // ¿Día/mes o mes/día? Se decide mirando todas las fechas del chat.
  let dayFirst = true;
  const found = heads.filter((h): h is RawLine => !!h);
  if (found.some((h) => h.b > 12) && !found.some((h) => h.a > 12)) dayFirst = false;

  type Msg = { author: string | null; date: string | null; lines: string[] };
  const msgs: Msg[] = [];
  for (let i = 0; i < lines.length; i++) {
    const h = heads[i];
    if (!h) {
      if (msgs.length) msgs[msgs.length - 1].lines.push(lines[i]);
      continue;
    }
    const day = dayFirst ? h.a : h.b;
    const month = dayFirst ? h.b : h.a;
    const year = h.y < 100 ? 2000 + h.y : h.y;
    let hour = h.h;
    if (h.ampm === "pm" && hour < 12) hour += 12;
    if (h.ampm === "am" && hour === 12) hour = 0;
    const valid = month >= 1 && month <= 12 && day >= 1 && day <= 31;
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = valid ? `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(h.min)}:${pad(h.s)}` : null;
    const sep = h.rest.indexOf(": ");
    const isAuthor = sep > 0 && sep <= 60 && !SYSTEM.some((r) => r.test(h.rest.slice(0, sep)));
    if (isAuthor) msgs.push({ author: h.rest.slice(0, sep).trim(), date, lines: [h.rest.slice(sep + 2)] });
    else if (h.rest.endsWith(":") && h.rest.length <= 61) msgs.push({ author: h.rest.slice(0, -1).trim(), date, lines: [""] });
    else msgs.push({ author: null, date, lines: [h.rest] });
  }

  const blocks: ParsedChat["blocks"] = [];
  const attachments: string[] = [];
  const participants: string[] = [];
  let skipped = 0;
  for (const m of msgs) {
    if (!m.author) {
      skipped++;
      continue;
    }
    const media: string[] = [];
    const textLines: string[] = [];
    for (const line of m.lines) {
      const t = line.trim();
      const ios = t.match(IOS_ATTACH);
      const android = t.match(ANDROID_ATTACH);
      if (ios || android) {
        const name = (ios?.[1] ?? android?.[1] ?? "").trim();
        attachments.push(name);
        if (IMAGE_EXT.test(name)) media.push(name);
        continue;
      }
      if (OMITTED.test(t)) continue;
      textLines.push(line);
    }
    const text = textLines.join("\n").replace(EDITED, "").trim();
    if (DELETED.test(text) || (!text && !media.length)) {
      skipped++;
      continue;
    }
    if (!participants.includes(m.author)) participants.push(m.author);
    blocks.push({ type: "message", author: m.author, date: m.date, text, media });
  }
  return { blocks, participants, attachments, skipped };
}

/** «Chat de WhatsApp con Ana.txt» → «Ana». */
export function chatNameFromFile(file: string): string {
  const base = file.replace(/\.(txt|zip)$/i, "").replace(/^.*[\\/]/, "");
  const m = base.match(/(?:chat de whatsapp con|whatsapp chat with|chat con)\s+(.+)$/i);
  return (m ? m[1] : base).replace(/_/g, " ").trim() || "Chat";
}

/** ¿Este texto parece un chat exportado? */
export function looksLikeWhatsApp(raw: string): boolean {
  const lines = clean(raw).split(/\r?\n/).slice(0, 60).filter(Boolean);
  if (!lines.length) return false;
  const hits = lines.filter((l) => LINE.test(l)).length;
  return hits / lines.length > 0.4;
}
