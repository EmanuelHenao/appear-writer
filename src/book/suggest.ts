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

/** Lo que cada mensaje aporta a las sugerencias y no depende de las ediciones. */
interface Features {
  all: Msg[];
  emoji: Set<string>;
  sticker: Set<string>;
  laugh: Set<string>;
  short: Set<string>;
  /** Con algo de texto (no solo emojis), en orden. */
  withText: Msg[];
  /** Los de 120 caracteres o más, del más largo al más corto. */
  longest: Msg[];
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

const words = (t: string) => t.toLowerCase().replace(/[!¡?¿.,…]+/g, " ").trim().split(/\s+/).filter(Boolean);

// Las expresiones regulares y el orden por longitud se calculan una vez por
// juego de fuentes; cada edición solo filtra con lo ya calculado.
const cache = new WeakMap<Source[], Features>();
function featuresOf(sources: Source[]): Features {
  const hit = cache.get(sources);
  if (hit) return hit;
  const all = messages(sources);
  const f: Features = { all, emoji: new Set(), sticker: new Set(), laugh: new Set(), short: new Set(), withText: [], longest: [] };
  for (const m of all) {
    const emojiOnly = !!m.text && EMOJI_ONLY.test(m.text);
    if (!m.media.length && emojiOnly) f.emoji.add(m.key);
    if (!m.text && m.media.length && m.media.every((x) => /\.webp$/i.test(x))) f.sticker.add(m.key);
    if (!m.media.length && m.text) {
      const w = words(m.text);
      if (w.every(isLaugh)) f.laugh.add(m.key);
      if (w.length === 1 && SHORT.has(w[0])) f.short.add(m.key);
    }
    if (m.text.length >= 2 && !emojiOnly) {
      f.withText.push(m);
      if (m.text.length >= 120) f.longest.push(m);
    }
  }
  f.longest.sort((a, b) => b.text.length - a.text.length);
  cache.set(sources, f);
  return f;
}

export function suggestEdits(sources: Source[], edits: BookEdits): Suggestion[] {
  const f = featuresOf(sources);
  const isVisible = (key: string) => !edits.blocks[key]?.hidden;
  const isPlain = (key: string) => isVisible(key) && (!edits.blocks[key]?.design || edits.blocks[key]?.design === "normal");
  // Cada conjunto conserva el orden del chat: se recorre solo lo que contiene.
  const keysOf = (set: Set<string>) => [...set].filter(isPlain);

  const hide: Suggestion[] = [
    { id: "emojis", kind: "ocultar", label: "Solo emojis", hint: "«👍», «❤️», «😂😂» sin texto ni foto", suggested: true, keys: keysOf(f.emoji) },
    { id: "stickers", kind: "ocultar", label: "Stickers", hint: "Imágenes .webp del chat, sin texto", suggested: true, keys: keysOf(f.sticker) },
    { id: "risas", kind: "ocultar", label: "Solo risas", hint: "«jajaja», «jsjs», «xd»", suggested: false, keys: keysOf(f.laugh) },
    { id: "cortas", kind: "ocultar", label: "Respuestas de una palabra", hint: "«ok», «vale», «sí», «dale», «ya»", suggested: false, keys: keysOf(f.short) },
  ];

  // Lo destacado se calcula sobre todo el chat (el primer mensaje es siempre el mismo)
  // y luego se quita lo que ya está destacado.
  const withText = f.withText.filter((m) => isVisible(m.key));
  const first = withText[0];
  const visibleLong = f.longest.filter((m) => isVisible(m.key));
  const long = visibleLong.filter((m) => m.text.length >= 280).slice(0, 5);
  const longKeys = (long.length ? long : visibleLong.slice(0, 3)).map((m) => m.key);

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

  for (const h of highlight) h.keys = h.keys.filter(isPlain);
  return [...hide, ...highlight].filter((s) => s.keys.length);
}
