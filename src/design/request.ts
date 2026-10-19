import { z } from "zod";
import { DesignSchema, ImageOptionsSchema } from "./compose";

export const PhotoSchema = z.object({
  url: z.string(),
  thumb: z.string().optional(),
  credit: z.string().optional(),
  creditUrl: z.string().optional(),
  source: z.enum(["unsplash", "pexels", "ia", "subida"]).optional(),
});

/** Lo que el estudio envía al servidor para exportar una imagen. */
export const ImageRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  options: ImageOptionsSchema,
  design: DesignSchema,
  sizeScale: z.number().min(0.5).max(1.5).default(1),
  emphasis: z.array(z.string()).default([]),
  label: z.string().max(40).optional(),
  photo: PhotoSchema.nullable().optional(),
  caption: z.object({ texto: z.string(), hashtags: z.array(z.string()) }).optional(),
});

export type ImageRequest = z.infer<typeof ImageRequestSchema>;
