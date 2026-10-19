import { z } from "zod";
import type { Source } from "./model";

// Opciones del libro. Todas tienen un valor sugerido y el usuario puede
// cambiarlas antes de generar.

export const BookOptionsSchema = z.object({
  pageSize: z.enum(["a5", "6x9", "cuadrado"]),
  bleed: z.boolean(),
  font: z.enum(["cormorant", "caslon", "lora", "fraunces"]),
  fontScale: z.enum(["pequena", "normal", "grande"]),
  palette: z.enum(["verde-oro", "vino-rosa", "tinta-azul", "lino-natural"]),
  cover: z.object({
    template: z.enum(["tela", "tipografica", "formas", "lino"]),
    title: z.string().max(120),
    subtitle: z.string().max(160),
    author: z.string().max(120),
  }),
  content: z.object({
    onePerPage: z.boolean(),
    showName: z.boolean(),
    showDate: z.boolean(),
    showTime: z.boolean(),
    ornaments: z.boolean(),
    chatPhotos: z.boolean(),
    stockPhotos: z.boolean(),
    chaptersByMonth: z.boolean(),
    titlePage: z.boolean(),
    toc: z.boolean(),
    dedication: z.string().max(400),
  }),
  ai: z.object({ chapters: z.boolean(), spelling: z.boolean(), title: z.boolean(), cover: z.boolean() }),
  outputs: z.object({ pdf: z.boolean(), epub: z.boolean(), png: z.boolean() }),
});

export type BookOptions = z.infer<typeof BookOptionsSchema>;

export const PAGE_SIZES = {
  a5: { w: 148, h: 210, label: "A5", hint: "14,8 × 21 cm" },
  "6x9": { w: 152.4, h: 228.6, label: "6 × 9 in", hint: "Estándar de imprenta y Amazon KDP" },
  cuadrado: { w: 210, h: 210, label: "Cuadrado 21 cm", hint: "Álbum de recuerdos" },
} as const;

export const BLEED_MM = 3;

export interface BookPalette {
  id: BookOptions["palette"];
  label: string;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  deep: string;
  onDeep: string;
  soft: string;
}

export const BOOK_PALETTES: BookPalette[] = [
  { id: "verde-oro", label: "Tela verde y oro", paper: "#F4EFE4", ink: "#2A2622", muted: "#8A7F6E", accent: "#C9A45C", deep: "#1F3A33", onDeep: "#E6CF96", soft: "#D8CFBF" },
  { id: "vino-rosa", label: "Vino y rosa", paper: "#FBF6F1", ink: "#2E2326", muted: "#8C7378", accent: "#B4507E", deep: "#7A2E3A", onDeep: "#F2C9C0", soft: "#EBD8D2" },
  { id: "tinta-azul", label: "Tinta azul", paper: "#F3F4F6", ink: "#1B2430", muted: "#6B7686", accent: "#C58B2E", deep: "#16202E", onDeep: "#F3F4F6", soft: "#D5DCE6" },
  { id: "lino-natural", label: "Lino natural", paper: "#F6F1E7", ink: "#3A332B", muted: "#8A7F6E", accent: "#8A6F4E", deep: "#D9CFBD", onDeep: "#3A332B", soft: "#E4DACA" },
];

export function bookPalette(id: string): BookPalette {
  return BOOK_PALETTES.find((p) => p.id === id) ?? BOOK_PALETTES[0];
}

export const COVERS = [
  { id: "tela", label: "Tela y oro", hint: "Clásica, con marco dorado" },
  { id: "tipografica", label: "Tipográfica", hint: "Título enorme, moderna" },
  { id: "formas", label: "Formas", hint: "Dos círculos: dos voces" },
  { id: "lino", label: "Lino y etiqueta", hint: "Tipo álbum de fotos" },
] as const;

function yearOf(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 4) : "";
}

/** Valores sugeridos a partir de las fuentes cargadas. */
export function suggestedBookOptions(sources: Source[]): BookOptions {
  const chats = sources.filter((s) => s.kind === "whatsapp");
  const onlyChats = sources.length > 0 && chats.length === sources.length;
  const first = sources[0];
  let title = first ? first.name : "Mi libro";
  let subtitle = "";
  if (onlyChats && chats.length === 1) {
    title = `Conversaciones con ${first.name}`;
    const a = yearOf(first.meta.firstDate);
    const b = yearOf(first.meta.lastDate);
    subtitle = a && b ? (a === b ? a : `${a} – ${b}`) : "";
  }
  const hasImages = sources.some((s) => (s.meta.images ?? 0) > 0);
  return {
    pageSize: "a5",
    bleed: true,
    font: "cormorant",
    fontScale: "normal",
    palette: "verde-oro",
    cover: { template: onlyChats ? "formas" : "tela", title, subtitle, author: "" },
    content: {
      onePerPage: onlyChats,
      showName: true,
      showDate: true,
      showTime: false,
      ornaments: true,
      chatPhotos: hasImages,
      stockPhotos: false,
      chaptersByMonth: chats.length > 0,
      titlePage: true,
      toc: true,
      dedication: "",
    },
    ai: { chapters: false, spelling: false, title: false, cover: false },
    outputs: { pdf: true, epub: true, png: false },
  };
}
