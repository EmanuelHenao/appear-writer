import type { FontId } from "./fonts";
import type { FormatId } from "./fit";
import type { Palette } from "./palettes";
import type { PatternDesign } from "./patterns";

export type FamilyId = "bold" | "vivo" | "minimal" | "arte";

export const FAMILIES: { id: FamilyId; label: string; hint: string }[] = [
  { id: "bold", label: "Bold editorial", hint: "Letra enorme, alto contraste" },
  { id: "vivo", label: "Color vivo", hint: "Bloques y degradados intensos" },
  { id: "minimal", label: "Minimalista", hint: "Mucho aire, serif fina" },
  { id: "arte", label: "Artístico", hint: "Papel, collage, acuarela" },
];

export type BackgroundKind = "estilo" | "plano" | "degradado" | "textura" | "patron" | "foto" | "ia";

export const BACKGROUNDS: { id: BackgroundKind; label: string }[] = [
  { id: "estilo", label: "El del estilo" },
  { id: "plano", label: "Color plano" },
  { id: "degradado", label: "Degradado" },
  { id: "textura", label: "Textura" },
  { id: "patron", label: "Patrón generativo" },
  { id: "foto", label: "Foto real" },
  { id: "ia", label: "Fondo IA" },
];

export interface PhotoRef {
  url: string;
  thumb?: string;
  credit?: string;
  creditUrl?: string;
  source?: "unsplash" | "pexels" | "ia" | "subida";
}

/** Todo lo necesario para dibujar una diapositiva. */
export interface SlideSpec {
  templateId: string;
  text: string;
  width: number;
  height: number;
  palette: Palette;
  /** Fuente principal elegida; null = la de la plantilla. */
  font: FontId | null;
  sizeScale: number;
  background: BackgroundKind;
  photo?: PhotoRef | null;
  /** Patrón generativo cuando background es «patron». */
  pattern?: PatternDesign | null;
  emphasis: string[];
  /** Etiqueta corta opcional (por ejemplo «Lunes» o «Regla nº 3»). */
  label?: string;
  brand: { handle?: string; logoUrl?: string };
  /** 1-based; total 1 si no es carrusel. */
  index: number;
  total: number;
}

export interface FormatChoice {
  format: FormatId;
  /** Proporción de cada diapositiva cuando el formato es carrusel. */
  carouselAspect: "4:5" | "1:1";
}

export function slideSize(choice: FormatChoice): { w: number; h: number } {
  const f = choice.format === "carrusel" ? choice.carouselAspect : choice.format;
  if (f === "1:1") return { w: 1080, h: 1080 };
  if (f === "9:16") return { w: 1080, h: 1920 };
  return { w: 1080, h: 1350 };
}
