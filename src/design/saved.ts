import { z } from "zod";
import { DesignSchema } from "./compose";

/** Un diseño que el usuario marcó para reutilizarlo con otros textos. */
export const SavedTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(60),
  createdAt: z.string(),
  design: DesignSchema,
  sizeScale: z.number().min(0.5).max(1.5).default(1),
});
export type SavedTemplate = z.infer<typeof SavedTemplateSchema>;

export const NewTemplateSchema = SavedTemplateSchema.pick({ name: true, design: true, sizeScale: true });
