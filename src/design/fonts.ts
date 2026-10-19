// Registro de tipografías. Se comparte entre el cliente (vista previa) y el
// servidor (render con Chromium). Los archivos vienen de paquetes @fontsource
// para que todo funcione sin conexión y con los mismos nombres de familia.

export type FontId =
  | "anton"
  | "bigshoulders"
  | "archivo"
  | "bricolage"
  | "syne"
  | "cormorant"
  | "jost"
  | "fraunces"
  | "caveat"
  | "dmserif"
  | "playfair"
  | "caslon"
  | "lora"
  | "instrument"
  | "jetbrains"
  | "unbounded";

export interface FontDef {
  id: FontId;
  label: string;
  family: string;
  fallback: string;
  /** Hojas de estilo de @fontsource, relativas a node_modules. */
  css: string[];
  role: "display" | "texto" | "mano" | "mono";
  /** Uso sugerido, en palabras del usuario. */
  hint: string;
}

export const FONTS: Record<FontId, FontDef> = {
  anton: {
    id: "anton",
    label: "Anton",
    family: "'Anton'",
    fallback: "Impact, 'Arial Narrow', sans-serif",
    css: ["@fontsource/anton/latin-400.css"],
    role: "display",
    hint: "Póster, letra gigante",
  },
  bigshoulders: {
    id: "bigshoulders",
    label: "Big Shoulders",
    family: "'Big Shoulders Display Variable'",
    fallback: "'Arial Narrow', sans-serif",
    css: ["@fontsource-variable/big-shoulders-display/wght.css"],
    role: "display",
    hint: "Condensada, editorial",
  },
  archivo: {
    id: "archivo",
    label: "Archivo Wide",
    family: "'Archivo Variable'",
    fallback: "'Arial Black', sans-serif",
    css: ["@fontsource-variable/archivo/wdth.css"],
    role: "display",
    hint: "Ancha y contundente",
  },
  bricolage: {
    id: "bricolage",
    label: "Bricolage",
    family: "'Bricolage Grotesque Variable'",
    fallback: "system-ui, sans-serif",
    css: ["@fontsource-variable/bricolage-grotesque/wght.css"],
    role: "display",
    hint: "Moderna con carácter",
  },
  syne: {
    id: "syne",
    label: "Syne",
    family: "'Syne Variable'",
    fallback: "system-ui, sans-serif",
    css: ["@fontsource-variable/syne/wght.css"],
    role: "display",
    hint: "Geométrica y audaz",
  },
  unbounded: {
    id: "unbounded",
    label: "Unbounded",
    family: "'Unbounded Variable'",
    fallback: "system-ui, sans-serif",
    css: ["@fontsource-variable/unbounded/wght.css"],
    role: "display",
    hint: "Redonda y amplia",
  },
  cormorant: {
    id: "cormorant",
    label: "Cormorant",
    family: "'Cormorant Garamond Variable'",
    fallback: "Georgia, serif",
    css: [
      "@fontsource-variable/cormorant-garamond/wght.css",
      "@fontsource-variable/cormorant-garamond/wght-italic.css",
    ],
    role: "texto",
    hint: "Clásica, para recuerdos y poesía",
  },
  caslon: {
    id: "caslon",
    label: "Caslon",
    family: "'Libre Caslon Text'",
    fallback: "Georgia, serif",
    css: [
      "@fontsource/libre-caslon-text/latin-400.css",
      "@fontsource/libre-caslon-text/latin-400-italic.css",
      "@fontsource/libre-caslon-text/latin-700.css",
    ],
    role: "texto",
    hint: "Sobria, para ensayo y novela",
  },
  lora: {
    id: "lora",
    label: "Lora",
    family: "'Lora Variable'",
    fallback: "Georgia, serif",
    css: ["@fontsource-variable/lora/wght.css", "@fontsource-variable/lora/wght-italic.css"],
    role: "texto",
    hint: "Cálida, para diarios y notas",
  },
  fraunces: {
    id: "fraunces",
    label: "Fraunces",
    family: "'Fraunces Variable'",
    fallback: "Georgia, serif",
    css: ["@fontsource-variable/fraunces/wght.css", "@fontsource-variable/fraunces/wght-italic.css"],
    role: "texto",
    hint: "Moderna, para frases y regalo",
  },
  playfair: {
    id: "playfair",
    label: "Playfair",
    family: "'Playfair Display Variable'",
    fallback: "Georgia, serif",
    css: [
      "@fontsource-variable/playfair-display/wght.css",
      "@fontsource-variable/playfair-display/wght-italic.css",
    ],
    role: "texto",
    hint: "Elegante y contrastada",
  },
  dmserif: {
    id: "dmserif",
    label: "DM Serif",
    family: "'DM Serif Display'",
    fallback: "Georgia, serif",
    css: ["@fontsource/dm-serif-display/latin-400.css", "@fontsource/dm-serif-display/latin-400-italic.css"],
    role: "texto",
    hint: "Serif expresiva",
  },
  caveat: {
    id: "caveat",
    label: "Caveat",
    family: "'Caveat Variable'",
    fallback: "'Comic Sans MS', cursive",
    css: ["@fontsource-variable/caveat/wght.css"],
    role: "mano",
    hint: "Escrita a mano",
  },
  jost: {
    id: "jost",
    label: "Jost",
    family: "'Jost Variable'",
    fallback: "system-ui, sans-serif",
    css: ["@fontsource-variable/jost/wght.css", "@fontsource-variable/jost/wght-italic.css"],
    role: "texto",
    hint: "Sans limpia para detalles",
  },
  instrument: {
    id: "instrument",
    label: "Instrument Sans",
    family: "'Instrument Sans Variable'",
    fallback: "system-ui, sans-serif",
    css: ["@fontsource-variable/instrument-sans/wght.css"],
    role: "texto",
    hint: "Interfaz",
  },
  jetbrains: {
    id: "jetbrains",
    label: "JetBrains Mono",
    family: "'JetBrains Mono Variable'",
    fallback: "ui-monospace, monospace",
    css: ["@fontsource-variable/jetbrains-mono/wght.css"],
    role: "mono",
    hint: "Detalles técnicos",
  },
};

export function fontStack(id: FontId): string {
  const f = FONTS[id];
  return `${f.family}, ${f.fallback}`;
}

/** Tipografías que el usuario puede elegir para las imágenes. */
export const IMAGE_FONT_CHOICES: FontId[] = [
  "anton",
  "bigshoulders",
  "archivo",
  "bricolage",
  "syne",
  "unbounded",
  "cormorant",
  "fraunces",
  "playfair",
  "dmserif",
  "caveat",
];

/** Tipografías para el interior del libro. */
export const BOOK_FONT_CHOICES: FontId[] = ["cormorant", "caslon", "lora", "fraunces"];
