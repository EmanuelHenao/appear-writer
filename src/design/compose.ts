import { z } from "zod";
import { readText, splitSlides, type FormatId, type TextReading } from "./fit";
import type { FontId } from "./fonts";
import { brandPalette, getPalette, type Palette } from "./palettes";
import { FAMILIES, slideSize, type BackgroundKind, type FamilyId, type PhotoRef, type SlideSpec } from "./spec";
import {
  DEFAULT_EMOJIS,
  IntensityEnum,
  makePattern,
  makeRng,
  PatternDesignSchema,
  PatternIdEnum,
  splitEmojis,
  type PatternId,
} from "./patterns";
import { TEMPLATES, getTemplate, templatesOf } from "./templates";
import { IMAGE_FONT_CHOICES } from "./fonts";
import { PALETTES } from "./palettes";

// Opciones del panel de Imágenes. Cada campo tiene un valor sugerido por
// el sistema y el usuario puede cambiarlo antes de crear las propuestas.

const FamilyEnum = z.enum(["bold", "vivo", "minimal", "arte"]);
const BackgroundEnum = z.enum(["estilo", "plano", "degradado", "textura", "patron", "foto", "ia"]);

/** Tipos de patrón sugeridos: los que funcionan con casi cualquier texto. */
export const SUGGESTED_PATTERNS: PatternId[] = ["truchet", "bauhaus", "semitono", "flujo", "ondas", "topografico", "ascii-ruido"];

export const PatternOptionsSchema = z.object({
  /** Tipos marcados: solo estos entran en la generación. */
  kinds: z.array(PatternIdEnum).min(1),
  /** Varios patrones superpuestos en la misma imagen. */
  combine: z.boolean(),
  layers: z.number().int().min(2).max(3),
  intensity: IntensityEnum,
  emojis: z.string().max(80),
});
export type PatternOptions = z.infer<typeof PatternOptionsSchema>;

export function suggestedPatternOptions(text = ""): PatternOptions {
  const found = splitEmojis(text);
  return {
    kinds: found.length ? [...SUGGESTED_PATTERNS, "emoji-rejilla", "emoji-lluvia"] : [...SUGGESTED_PATTERNS],
    combine: false,
    layers: 2,
    intensity: "media",
    emojis: found.length ? Array.from(new Set(found)).join("") : DEFAULT_EMOJIS,
  };
}

export const ImageOptionsSchema = z.object({
  format: z.enum(["4:5", "1:1", "9:16", "carrusel"]),
  carouselAspect: z.enum(["4:5", "1:1"]),
  hiRes: z.boolean(),
  families: z.array(FamilyEnum).min(1),
  font: z.string(),
  palette: z.string(),
  backgrounds: z.array(BackgroundEnum).min(1),
  patterns: PatternOptionsSchema.default(suggestedPatternOptions()),
  brand: z.object({ handle: z.boolean(), logo: z.boolean(), palette: z.boolean(), font: z.boolean() }),
  extras: z.object({ gallery: z.boolean(), caption: z.boolean(), hashtags: z.boolean() }),
  ai: z.object({ suggest: z.boolean() }),
});

export type ImageOptions = z.infer<typeof ImageOptionsSchema>;

export function suggestedImageOptions(reading: TextReading, brand?: { handle: string }): ImageOptions {
  return {
    format: reading.suggestedFormat,
    carouselAspect: "4:5",
    hiRes: true,
    families: FAMILIES.map((f) => f.id),
    font: "auto",
    palette: "auto",
    backgrounds: ["estilo", "textura", "patron"],
    patterns: suggestedPatternOptions(reading.text),
    brand: { handle: !!brand?.handle, logo: false, palette: false, font: false },
    extras: { gallery: true, caption: false, hashtags: false },
    ai: { suggest: false },
  };
}

/** Una de las propuestas: la combinación de plantilla, paleta, fuente y fondo. */
export const DesignSchema = z.object({
  templateId: z.string(),
  paletteId: z.string(),
  font: z.string().nullable(),
  background: BackgroundEnum,
  /** Patrón concreto (semilla y capas) cuando el fondo es «patron». */
  pattern: PatternDesignSchema.nullable().optional(),
});
export type Design = z.infer<typeof DesignSchema>;

/**
 * Elige cuatro propuestas alternando familias. «seed» desplaza las
 * plantillas y paletas para «Crear otras 4».
 */
export function buildProposals(opts: ImageOptions, seed = 0, count = 4, saved: Design[] = []): Design[] {
  // Se respeta el orden elegido: la IA puede poner primero la familia que mejor encaja.
  const known = new Set(FAMILIES.map((f) => f.id));
  const families = Array.from(new Set(opts.families)).filter((f) => known.has(f));
  const pool: { family: FamilyId; t: ReturnType<typeof getTemplate> }[] = [];
  const maxPer = Math.max(...families.map((f) => templatesOf(f).length));
  for (let i = 0; i < maxPer; i++) {
    for (const f of families) {
      const list = templatesOf(f);
      if (list[i]) pool.push({ family: f, t: list[i] });
    }
  }
  const out: Design[] = [];
  const bgs = opts.backgrounds;
  for (let i = 0; i < count; i++) {
    // Las plantillas guardadas que el usuario marcó van primero.
    const n = i + seed * count;
    if (n < saved.length) {
      out.push(saved[n]);
      continue;
    }
    const k = n - saved.length;
    const pick = pool[k % pool.length];
    const round = Math.floor(k / pool.length);
    const t = pick.t;
    const paletteId =
      opts.palette !== "auto"
        ? opts.palette
        : round === 0
          ? t.defaultPalette
          : t.altPalettes[(round - 1) % t.altPalettes.length];
    const background = bgs[(i + seed) % bgs.length];
    out.push({
      templateId: t.id,
      paletteId,
      font: opts.font !== "auto" ? opts.font : null,
      background,
      pattern: background === "patron" ? makePattern(opts.patterns, 1000 + k * 37 + seed) : null,
    });
  }
  return out;
}

/**
 * Un diseño al azar dentro de lo que el usuario dejó marcado: estilos,
 * fondos y tipos de patrón. Paleta y letra solo varían si están en «auto».
 */
export function randomDesign(opts: ImageOptions, seed: number, available?: (b: BackgroundKind) => boolean): Design {
  const r = makeRng(seed);
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
  const known = new Set(FAMILIES.map((f) => f.id));
  const families = opts.families.filter((f) => known.has(f));
  const templates = TEMPLATES.filter((t) => families.includes(t.family));
  const t = pick(templates.length ? templates : TEMPLATES);
  const bgs = opts.backgrounds.filter((b) => (available ? available(b) : true));
  const background = pick(bgs.length ? bgs : (["estilo"] as BackgroundKind[]));
  return {
    templateId: t.id,
    paletteId: opts.palette !== "auto" ? opts.palette : r() < 0.4 ? t.defaultPalette : pick(PALETTES).id,
    font: opts.font !== "auto" ? opts.font : r() < 0.5 ? null : pick(IMAGE_FONT_CHOICES),
    background,
    pattern: background === "patron" ? makePattern(opts.patterns, Math.floor(r() * 2 ** 31)) : null,
  };
}

export interface BrandAssets {
  handle: string;
  logoUrl?: string;
  colors: { bg: string; fg: string; accent: string };
  font: string;
}

export interface ComposeInput {
  text: string;
  options: ImageOptions;
  design: Design;
  sizeScale?: number;
  emphasis?: string[];
  label?: string;
  photo?: PhotoRef | null;
  brand?: BrandAssets | null;
}

export function resolvePalette(input: ComposeInput): Palette {
  if (input.options.brand.palette && input.brand) {
    const c = input.brand.colors;
    return brandPalette(c.bg, c.fg, c.accent);
  }
  return getPalette(input.design.paletteId);
}

/** Convierte texto + propuesta en las diapositivas a dibujar. */
export function composeSlides(input: ComposeInput): SlideSpec[] {
  const reading = readText(input.text);
  const { options, design } = input;
  const format: FormatId = options.format;
  const { w, h } = slideSize({ format, carouselAspect: options.carouselAspect });
  const texts = format === "carrusel" ? (reading.slides.length ? reading.slides : [reading.text]) : [reading.text];
  const palette = resolvePalette(input);
  const font =
    options.brand.font && input.brand ? (input.brand.font as FontId) : ((design.font as FontId | null) ?? null);
  const emphasis = input.emphasis ?? reading.emphasis;
  const brand = {
    handle: options.brand.handle && input.brand?.handle ? input.brand.handle : undefined,
    logoUrl: options.brand.logo && input.brand?.logoUrl ? input.brand.logoUrl : undefined,
  };
  // Sin foto elegida, «foto» e «ia» caen en textura hasta que haya imagen.
  const needsPhoto = design.background === "foto" || design.background === "ia";
  const background: BackgroundKind = needsPhoto && !input.photo?.url ? "textura" : design.background;
  return texts.map((text, i) => ({
    templateId: design.templateId,
    text,
    width: w,
    height: h,
    palette,
    font,
    sizeScale: input.sizeScale ?? 1,
    background,
    photo: needsPhoto ? input.photo ?? null : null,
    pattern: background === "patron" ? (design.pattern ?? makePattern(options.patterns, 1)) : null,
    emphasis,
    label: input.label,
    brand,
    index: i + 1,
    total: texts.length,
  }));
}

export { splitSlides };
