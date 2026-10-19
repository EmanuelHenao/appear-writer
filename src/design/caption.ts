// Texto de la publicación y hashtags sin IA: plantillas fijas y palabras
// clave sacadas del propio texto. Determinista: el mismo texto, estilo y
// versión dan siempre el mismo resultado.

export interface Caption {
  texto: string;
  hashtags: string[];
}

export const CAPTION_STYLES = [
  { id: "reflexion", label: "Reflexión", hint: "La frase y una pregunta" },
  { id: "guardar", label: "Para guardar", hint: "Invita a guardar o compartir" },
  { id: "breve", label: "Breve", hint: "Solo la frase y la firma" },
] as const;
export type CaptionStyle = (typeof CAPTION_STYLES)[number]["id"];

const CLOSERS: Record<CaptionStyle, string[]> = {
  reflexion: ["¿Te ha pasado? Te leo en comentarios.", "¿Con qué parte te quedas?", "Cuéntame qué te hace pensar.", "¿Lo ves igual?"],
  guardar: [
    "Guárdalo para cuando lo necesites.",
    "Compártelo con alguien que necesite leerlo hoy.",
    "Guárdalo y vuelve a leerlo cuando haga falta.",
    "Envíaselo a quien te vino a la mente.",
  ],
  breve: [""],
};

const STOPWORDS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes aqui asi aun aunque bien cada casi como con contra cual cuales cuando de del desde donde dos el ella ellas ello ellos en entre era eran eres es esa esas ese eso esos esta estaba estado estan estar estas este esto estos estoy fue fueron ha haber habia hace hacer hacia han hasta hay la las le les lo los mas me mi mia mias mio mios mis mismo mucho muchos muy nada ni no nos nosotros nuestra nuestro o otra otras otro otros para pero poco por porque puede pues que quien quienes se sea ser si sido sin sobre solo son su sus tambien tan tanto te ti tiene tienen todo todos tu tus un una uno unos ya yo " +
    "the and for you your with that this are was not but have from they will what all can just"
  ).split(" "),
);

const plain = (w: string) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Palabras con más peso del texto (sin las vacías), en orden de importancia. */
export function keywords(text: string, n = 6): string[] {
  const words = text.match(/\p{L}[\p{L}'’-]*/gu) ?? [];
  const score = new Map<string, { n: number; first: number }>();
  words.forEach((w, i) => {
    const k = plain(w).replace(/['’-]/g, "");
    if (k.length < 4 || STOPWORDS.has(k)) return;
    const s = score.get(k);
    if (s) s.n++;
    else score.set(k, { n: 1, first: i });
  });
  return [...score.entries()]
    .sort((a, b) => b[1].n - a[1].n || b[0].length - a[0].length || a[1].first - b[1].first)
    .slice(0, n)
    .map(([k]) => k);
}

/** Hashtags a partir de las palabras clave, sin tildes (así se buscan). */
export function templateHashtags(text: string, max = 8): string[] {
  const tags = keywords(text, max - 1).map((k) => `#${k}`);
  return [...tags, "#frases"].slice(0, max);
}

/** La frase entera si es corta; si no, la primera oración. */
function lead(text: string): string {
  const t = text.trim().replace(/\s+\n/g, "\n");
  if (t.length <= 220) return t;
  const first = t.match(/^[\s\S]+?[.!?…](\s|$)/)?.[0]?.trim();
  return first && first.length <= 220 ? `${first}…` : `${t.slice(0, 200).replace(/\s+\S*$/, "")}…`;
}

export function templateCaption(text: string, opts: { style: CaptionStyle; variant: number; handle?: string }): Caption {
  const closers = CLOSERS[opts.style];
  const closer = closers[((opts.variant % closers.length) + closers.length) % closers.length];
  const handle = opts.handle ? (opts.handle.startsWith("@") ? opts.handle : `@${opts.handle}`) : "";
  const texto = [lead(text), closer, handle ? `— ${handle}` : ""].filter(Boolean).join("\n\n");
  return { texto, hashtags: templateHashtags(text) };
}

/** ¿Cuántas versiones distintas tiene un estilo? */
export const captionVariants = (style: CaptionStyle) => CLOSERS[style].length;
