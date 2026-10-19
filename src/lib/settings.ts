import "server-only";
import { z } from "zod";
import { type AiConfigInput, maskKey, resolveAiConfig, type ResolvedAiConfig } from "./ai/detect";
import { dataPath, readJson, writeJson } from "./storage";

const ProviderEnum = z.enum([
  "auto",
  "anthropic",
  "openai",
  "gemini",
  "openrouter",
  "groq",
  "xai",
  "deepseek",
  "mistral",
  "compatible",
]);

export const SettingsSchema = z.object({
  ai: z
    .object({
      apiKey: z.string().default(""),
      provider: ProviderEnum.default("auto"),
      baseUrl: z.string().default(""),
      mainModel: z.string().default(""),
      fastModel: z.string().default(""),
    })
    .default({ apiKey: "", provider: "auto", baseUrl: "", mainModel: "", fastModel: "" }),
  photos: z
    .object({
      unsplashKey: z.string().default(""),
      pexelsKey: z.string().default(""),
    })
    .default({ unsplashKey: "", pexelsKey: "" }),
  brand: z
    .object({
      handle: z.string().default(""),
      logoFile: z.string().default(""),
      colors: z
        .object({ bg: z.string(), fg: z.string(), accent: z.string() })
        .default({ bg: "#111111", fg: "#F7F4EE", accent: "#B6A6FF" }),
      font: z.string().default("bricolage"),
    })
    .default({ handle: "", logoFile: "", colors: { bg: "#111111", fg: "#F7F4EE", accent: "#B6A6FF" }, font: "bricolage" }),
});

export type Settings = z.infer<typeof SettingsSchema>;

const FILE = () => dataPath("settings.json");

export async function loadSettings(): Promise<Settings> {
  const raw = await readJson<unknown>(FILE(), {});
  const parsed = SettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : SettingsSchema.parse({});
}

export async function saveSettings(s: Settings): Promise<void> {
  await writeJson(FILE(), SettingsSchema.parse(s));
}

/** La configuración guardada manda; las variables de entorno son el respaldo. */
export function aiInput(s: Settings): AiConfigInput {
  return {
    apiKey: s.ai.apiKey || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || "",
    provider: s.ai.provider !== "auto" ? s.ai.provider : ((process.env.AI_PROVIDER as AiConfigInput["provider"]) || "auto"),
    baseUrl: s.ai.baseUrl || process.env.AI_BASE_URL || "",
    mainModel: s.ai.mainModel || process.env.AI_MODEL || "",
    fastModel: s.ai.fastModel || process.env.AI_FAST_MODEL || "",
  };
}

export async function getAiConfig(): Promise<ResolvedAiConfig | null> {
  return resolveAiConfig(aiInput(await loadSettings()));
}

export function photoKeys(s: Settings) {
  return {
    unsplash: s.photos.unsplashKey || process.env.UNSPLASH_ACCESS_KEY || "",
    pexels: s.photos.pexelsKey || process.env.PEXELS_API_KEY || "",
  };
}

/** Lo que el navegador puede ver: nunca las keys completas. */
export function publicSettings(s: Settings) {
  const ai = resolveAiConfig(aiInput(s));
  const keys = photoKeys(s);
  return {
    ai: {
      apiKeyMasked: maskKey(aiInput(s).apiKey ?? ""),
      fromEnv: !s.ai.apiKey && !!aiInput(s).apiKey,
      provider: s.ai.provider,
      baseUrl: s.ai.baseUrl,
      mainModel: s.ai.mainModel,
      fastModel: s.ai.fastModel,
      resolved: ai
        ? {
            provider: ai.provider.id,
            label: ai.provider.label,
            mainModel: ai.mainModel,
            fastModel: ai.fastModel,
            images: ai.provider.images,
          }
        : null,
    },
    photos: {
      unsplash: !!keys.unsplash,
      pexels: !!keys.pexels,
      unsplashMasked: maskKey(keys.unsplash),
      pexelsMasked: maskKey(keys.pexels),
    },
    brand: { ...s.brand, logoUrl: logoUrl(s) },
  };
}

export type PublicSettings = ReturnType<typeof publicSettings>;

export function logoUrl(s: Settings): string | undefined {
  return s.brand.logoFile ? `/api/files/brand/${s.brand.logoFile}` : undefined;
}

/** Recursos de marca listos para componer diapositivas. */
export function brandAssets(s: Settings) {
  return {
    handle: s.brand.handle,
    logoUrl: logoUrl(s),
    colors: s.brand.colors,
    font: s.brand.font,
  };
}
