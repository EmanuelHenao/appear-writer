import type { BookEdits } from "./edits";
import type { Source } from "./model";

// Sugerencias sin IA para el paso Contenido: qué mensajes ocultar y cuáles
// destacar. Solo proponen; el usuario marca qué grupos se aplican. El
// importador de WhatsApp ya quita los avisos («Multimedia omitido»,
// «Se eliminó este mensaje») y los mensajes vacíos.

export interface Suggestion {
  id: string;
  kind: "ocultar" | "destacar";
  label: string;
  hint: string;
  /** Marcada de entrada (●). */
  suggested: boolean;
  keys: string[];
}

export const isLaugh = (w: string) => /^(j[aeiou]){2,}j?$|^(ha){2,}h?$|^(js){2,}j?$|^(xd)+$/i.test(w);

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s]+$/u;
const SHORT = new Set(["ok", "okey", "okay", "oki", "k", "vale", "si", "sí", "sip", "dale", "ya", "bueno", "listo", "va", "aja", "ajá", "no", "ah", "oh", "mmm", "jeje"]);
const SPECIAL_DAYS: Record<string, string> = { "01-01": "Año Nuevo", "02-14": "San Valentín", "12-24": "Nochebuena", "12-25": "Navidad" };

interface Msg {
  key: string;
  text: string;
  media: string[];
  date: string | null;
}

function messages(sources: Source[]): Msg[] {
  const out: Msg[] = [];
  for (const s of sources) {
    s.blocks.forEach((b, i) => {
      if (b.type === "message") out.push({ key: `${s.id}:${i}`, text: b.text.trim(), media: b.media, date: b.date });
    });
  }
  return out;
}

export function suggestEdits(sources: Source[], edits: BookEdits): Suggestion[] {
  const all = messages(sources);
  const visible = all.filter((m) => !edits.blocks[m.key]?.hidden);
  const plain = visible.filter((m) => !edits.blocks[m.key]?.design || edits.blocks[m.key]?.design === "normal");
  const words = (t: string) => t.toLowerCase().replace(/[!¡?¿.,…]+/g, " ").trim().split(/\s+/).filter(Boolean);

  const hide: Suggestion[] = [
    {
      id: "emojis",
      kind: "ocultar",
      label: "Solo emojis",
      hint: "«👍», «❤️», «😂😂» sin texto ni foto",
      suggested: true,
      keys: plain.filter((m) => !m.media.length && m.text && EMOJI_ONLY.test(m.text)).map((m) => m.key),
    },
    {
      id: "stickers",
      kind: "ocultar",
      label: "Stickers",
      hint: "Imágenes .webp del chat, sin texto",
      suggested: true,
      keys: plain.filter((m) => !m.text && m.media.length && m.media.every((f) => /\.webp$/i.test(f))).map((m) => m.key),
    },
    {
      id: "risas",
      kind: "ocultar",
      label: "Solo risas",
      hint: "«jajaja», «jsjs», «xd»",
      suggested: false,
      keys: plain.filter((m) => !m.media.length && m.text && words(m.text).every(isLaugh)).map((m) => m.key),
    },
    {
      id: "cortas",
      kind: "ocultar",
      label: "Respuestas de una palabra",
      hint: "«ok», «vale», «sí», «dale», «ya»",
      suggested: false,
      keys: plain.filter((m) => !m.media.length && words(m.text).length === 1 && SHORT.has(words(m.text)[0])).map((m) => m.key),
    },
  ];

  const withText = plain.filter((m) => m.text.length >= 2 && !EMOJI_ONLY.test(m.text));
  const first = withText[0];
  const byLength = [...withText].sort((a, b) => b.text.length - a.text.length);
  const long = byLength.filter((m) => m.text.length >= 280).slice(0, 5);
  const longKeys = (long.length ? long : byLength.filter((m) => m.text.length >= 120).slice(0, 3)).map((m) => m.key);

  // Un mensaje por fecha especial: el primero de ese día con algo de texto.
  const firstOfDay = new Map<string, Msg>();
  for (const m of withText) {
    const day = m.date?.slice(0, 10);
    if (day && !firstOfDay.has(day)) firstOfDay.set(day, m);
  }
  const special: string[] = [];
  const anniversaries: string[] = [];
  const startMd = first?.date?.slice(5, 10);
  const startY = first?.date?.slice(0, 4);
  for (const [day, m] of firstOfDay) {
    const md = day.slice(5);
    if (SPECIAL_DAYS[md]) special.push(m.key);
    if (startMd && md === startMd && day.slice(0, 4) !== startY) anniversaries.push(m.key);
  }

  const highlight: Suggestion[] = [
    { id: "primero", kind: "destacar", label: "El primer mensaje", hint: first ? `«${first.text.slice(0, 60)}${first.text.length > 60 ? "…" : ""}»` : "", suggested: true, keys: first ? [first.key] : [] },
    { id: "aniversarios", kind: "destacar", label: "Aniversarios", hint: "El primer mensaje de cada año en la fecha en que empezó el chat", suggested: true, keys: anniversaries },
    { id: "fechas", kind: "destacar", label: "Fechas especiales", hint: "1 de enero, 14 de febrero, 24 y 25 de diciembre", suggested: false, keys: special },
    { id: "largos", kind: "destacar", label: "Los mensajes más largos", hint: "Hasta 5 de más de 280 caracteres", suggested: false, keys: longKeys },
  ];

  return [...hide, ...highlight].filter((s) => s.keys.length);
}
