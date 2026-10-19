import { z } from "zod";
import { errorResponse } from "@/lib/http";
import { loadSettings, publicSettings, saveSettings } from "@/lib/settings";

export async function GET() {
  return Response.json(publicSettings(await loadSettings()));
}

const Patch = z.object({
  ai: z
    .object({
      apiKey: z.string().optional(),
      provider: z.string().optional(),
      baseUrl: z.string().optional(),
      mainModel: z.string().optional(),
      fastModel: z.string().optional(),
    })
    .optional(),
  photos: z.object({ unsplashKey: z.string().optional(), pexelsKey: z.string().optional() }).optional(),
  brand: z
    .object({
      handle: z.string().optional(),
      colors: z.object({ bg: z.string(), fg: z.string(), accent: z.string() }).optional(),
      font: z.string().optional(),
      removeLogo: z.boolean().optional(),
    })
    .optional(),
});

/** Solo cambia los campos enviados; una key vacía la borra. */
export async function PUT(req: Request) {
  try {
    const patch = Patch.parse(await req.json());
    const s = await loadSettings();
    if (patch.ai) {
      const { apiKey, provider, ...rest } = patch.ai;
      if (apiKey !== undefined) s.ai.apiKey = apiKey.trim();
      if (provider !== undefined) s.ai.provider = provider as typeof s.ai.provider;
      for (const [k, v] of Object.entries(rest)) if (v !== undefined) (s.ai as Record<string, string>)[k] = v.trim();
    }
    if (patch.photos) {
      if (patch.photos.unsplashKey !== undefined) s.photos.unsplashKey = patch.photos.unsplashKey.trim();
      if (patch.photos.pexelsKey !== undefined) s.photos.pexelsKey = patch.photos.pexelsKey.trim();
    }
    if (patch.brand) {
      if (patch.brand.handle !== undefined) s.brand.handle = patch.brand.handle.trim();
      if (patch.brand.colors) s.brand.colors = patch.brand.colors;
      if (patch.brand.font) s.brand.font = patch.brand.font;
      if (patch.brand.removeLogo) s.brand.logoFile = "";
    }
    await saveSettings(s);
    return Response.json(publicSettings(s));
  } catch (e) {
    return errorResponse(e);
  }
}
