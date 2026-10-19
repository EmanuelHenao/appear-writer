// Detección del proveedor de IA a partir de la API key. Sirve en cliente y
// servidor. Cualquier servicio compatible con la API de OpenAI funciona
// indicando su URL base.

export type ProviderId =
  | "anthropic"
  | "openai"
  | "gemini"
  | "openrouter"
  | "groq"
  | "xai"
  | "deepseek"
  | "mistral"
  | "compatible";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  /** Forma de la API: SDK de Anthropic, chat completions de OpenAI o Gemini. */
  api: "anthropic" | "openai" | "gemini";
  baseUrl: string;
  mainModel: string;
  fastModel: string;
  /** Si el proveedor genera imágenes de fondo. */
  images: boolean;
  imageModel?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic (Claude)",
    api: "anthropic",
    baseUrl: "https://api.anthropic.com",
    mainModel: "claude-sonnet-5-5",
    fastModel: "claude-haiku-5-5",
    images: false,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    api: "openai",
    baseUrl: "https://api.openai.com/v1",
    mainModel: "gpt-5",
    fastModel: "gpt-5-mini",
    images: true,
    imageModel: "gpt-image-1",
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    api: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    mainModel: "gemini-2.5-pro",
    fastModel: "gemini-2.5-flash",
    images: false,
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    api: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    mainModel: "anthropic/claude-sonnet-5.5",
    fastModel: "anthropic/claude-haiku-5.5",
    images: false,
  },
  groq: {
    id: "groq",
    label: "Groq",
    api: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    mainModel: "llama-3.3-70b-versatile",
    fastModel: "llama-3.1-8b-instant",
    images: false,
  },
  xai: {
    id: "xai",
    label: "xAI (Grok)",
    api: "openai",
    baseUrl: "https://api.x.ai/v1",
    mainModel: "grok-4",
    fastModel: "grok-4-fast",
    images: false,
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    api: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    mainModel: "deepseek-chat",
    fastModel: "deepseek-chat",
    images: false,
  },
  mistral: {
    id: "mistral",
    label: "Mistral",
    api: "openai",
    baseUrl: "https://api.mistral.ai/v1",
    mainModel: "mistral-large-latest",
    fastModel: "mistral-small-latest",
    images: false,
  },
  compatible: {
    id: "compatible",
    label: "Compatible con OpenAI (URL propia)",
    api: "openai",
    baseUrl: "",
    mainModel: "",
    fastModel: "",
    images: false,
  },
};

/**
 * Adivina el proveedor por el prefijo de la key. DeepSeek y Mistral usan
 * prefijos genéricos, así que se eligen a mano en Ajustes.
 */
export function detectProvider(apiKey: string): ProviderId | null {
  const k = apiKey.trim();
  if (!k) return null;
  if (k.startsWith("sk-ant-")) return "anthropic";
  if (k.startsWith("sk-or-")) return "openrouter";
  if (k.startsWith("AIza")) return "gemini";
  if (k.startsWith("gsk_")) return "groq";
  if (k.startsWith("xai-")) return "xai";
  if (k.startsWith("sk-")) return "openai";
  return "compatible";
}

export interface AiConfigInput {
  apiKey?: string;
  provider?: ProviderId | "auto";
  baseUrl?: string;
  mainModel?: string;
  fastModel?: string;
}

export interface ResolvedAiConfig {
  provider: ProviderInfo;
  apiKey: string;
  baseUrl: string;
  mainModel: string;
  fastModel: string;
}

/** Combina lo elegido por el usuario con los valores del proveedor. */
export function resolveAiConfig(input: AiConfigInput): ResolvedAiConfig | null {
  const apiKey = (input.apiKey ?? "").trim();
  const pid =
    input.provider && input.provider !== "auto" ? input.provider : detectProvider(apiKey);
  // Un servidor local compatible (Ollama, LM Studio) puede no pedir key.
  if (!pid || (!apiKey && pid !== "compatible")) return null;
  const provider = PROVIDERS[pid];
  const baseUrl = (input.baseUrl?.trim() || provider.baseUrl).replace(/\/+$/, "");
  if (!baseUrl) return null;
  const mainModel = input.mainModel?.trim() || provider.mainModel;
  const fastModel = input.fastModel?.trim() || provider.fastModel || mainModel;
  if (!mainModel) return null;
  return { provider, apiKey, baseUrl, mainModel, fastModel };
}

export function maskKey(key: string): string {
  const k = key.trim();
  if (!k) return "";
  if (k.length <= 10) return "••••";
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}
