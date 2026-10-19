import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ResolvedAiConfig } from "./detect";

// Un solo punto de entrada para pedir JSON a cualquier proveedor.
// Anthropic va por su SDK oficial con salida estructurada; OpenAI y
// compatibles por chat completions; Gemini por generateContent.

export class AiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

export interface JsonRequest<S extends z.ZodType> {
  schema: S;
  system: string;
  prompt: string;
  tier?: "main" | "fast";
  maxTokens?: number;
}

export async function generateJson<S extends z.ZodType>(
  cfg: ResolvedAiConfig,
  req: JsonRequest<S>,
): Promise<z.infer<S>> {
  const model = req.tier === "fast" ? cfg.fastModel : cfg.mainModel;
  const schemaText = JSON.stringify(z.toJSONSchema(req.schema));
  const system = `${req.system}\n\nResponde únicamente con un objeto JSON válido que cumpla este esquema JSON:\n${schemaText}`;

  if (cfg.provider.api === "anthropic") {
    return anthropicJson(cfg, model, { ...req, system: req.system });
  }

  const raw =
    cfg.provider.api === "gemini"
      ? await geminiText(cfg, model, system, req.prompt)
      : await openaiText(cfg, model, system, req.prompt);
  return parseJsonLoose(raw, req.schema);
}

/** Extrae y valida el primer objeto JSON de una respuesta de texto. */
export function parseJsonLoose<S extends z.ZodType>(raw: string, schema: S): z.infer<S> {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AiError("La IA respondió algo que no es JSON. Prueba otra vez o con otro modelo.", 502);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AiError("La respuesta de la IA no tiene el formato esperado. Prueba otra vez o con otro modelo.", 502);
  }
  return parsed.data;
}

function anthropicClient(cfg: ResolvedAiConfig) {
  return new Anthropic({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl, maxRetries: 2 });
}

async function anthropicJson<S extends z.ZodType>(
  cfg: ResolvedAiConfig,
  model: string,
  req: JsonRequest<S>,
): Promise<z.infer<S>> {
  const client = anthropicClient(cfg);
  try {
    const response = await client.messages.parse({
      model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system,
      messages: [{ role: "user", content: req.prompt }],
      output_config: { format: zodOutputFormat(req.schema) },
    });
    if (response.stop_reason === "refusal") {
      throw new AiError("La IA no quiso responder a este texto. Puedes seguir sin ayuda de la IA.", 422);
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("La respuesta de la IA se cortó por ser demasiado larga. Prueba con menos texto.", 502);
    }
    if (response.parsed_output == null) {
      throw new AiError("La respuesta de la IA no tiene el formato esperado. Prueba otra vez.", 502);
    }
    return response.parsed_output as z.infer<S>;
  } catch (e) {
    throw mapAnthropicError(e, model);
  }
}

function mapAnthropicError(e: unknown, model: string): Error {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.AuthenticationError) return new AiError("La API key de Anthropic no es válida.", 401);
  if (e instanceof Anthropic.PermissionDeniedError) return new AiError("Esta API key no tiene permiso para usar el modelo.", 403);
  if (e instanceof Anthropic.NotFoundError) return new AiError(`El modelo «${model}» no existe para esta cuenta.`, 404);
  if (e instanceof Anthropic.RateLimitError) return new AiError("Se alcanzó el límite de uso de la API. Espera un momento.", 429);
  if (e instanceof Anthropic.BadRequestError) return new AiError(`La API rechazó la petición: ${e.message}`, 400);
  if (e instanceof Anthropic.APIConnectionError) return new AiError("No se pudo conectar con Anthropic. Revisa la conexión.", 503);
  if (e instanceof Anthropic.APIError) return new AiError(`Error de Anthropic: ${e.message}`, e.status ?? 500);
  return e instanceof Error ? e : new Error(String(e));
}

async function httpError(res: Response, provider: string, model: string): Promise<AiError> {
  let detail = "";
  try {
    const body = await res.json();
    detail = body?.error?.message ?? body?.message ?? JSON.stringify(body).slice(0, 200);
  } catch {
    detail = res.statusText;
  }
  if (res.status === 401 || res.status === 403) return new AiError(`La API key de ${provider} no es válida o no tiene permiso.`, res.status);
  if (res.status === 404) return new AiError(`El modelo «${model}» no existe en ${provider}. Elige otro en Ajustes.`, 404);
  if (res.status === 429) return new AiError("Se alcanzó el límite de uso de la API. Espera un momento.", 429);
  return new AiError(`Error de ${provider} (${res.status}): ${detail}`, res.status);
}

async function openaiText(cfg: ResolvedAiConfig, model: string, system: string, prompt: string): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider.id === "openrouter") {
    headers["HTTP-Referer"] = "https://appear-writer.local";
    headers["X-Title"] = "Appear Writer";
  }
  const body = (withFormat: boolean) =>
    JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      ...(withFormat ? { response_format: { type: "json_object" } } : {}),
    });
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, { method: "POST", headers, body: body(true) });
    // Algunos servidores compatibles no aceptan response_format.
    if (res.status === 400) {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, { method: "POST", headers, body: body(false) });
    }
  } catch {
    throw new AiError(`No se pudo conectar con ${cfg.provider.label} en ${cfg.baseUrl}.`, 503);
  }
  if (!res.ok) throw await httpError(res, cfg.provider.label, model);
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new AiError("La IA devolvió una respuesta vacía.", 502);
  return content;
}

async function geminiText(cfg: ResolvedAiConfig, model: string, system: string, prompt: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
  } catch {
    throw new AiError("No se pudo conectar con Google Gemini.", 503);
  }
  if (!res.ok) throw await httpError(res, "Gemini", model);
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? "").join("") : "";
  if (!text) throw new AiError("Gemini devolvió una respuesta vacía.", 502);
  return text;
}

/** Lista los modelos disponibles para ayudar a elegir en Ajustes. */
export async function listModels(cfg: ResolvedAiConfig): Promise<string[]> {
  if (cfg.provider.api === "anthropic") {
    try {
      const ids: string[] = [];
      for await (const m of anthropicClient(cfg).models.list()) ids.push(m.id);
      return ids;
    } catch (e) {
      throw mapAnthropicError(e, "");
    }
  }
  if (cfg.provider.api === "gemini") {
    const res = await fetch(`${cfg.baseUrl}/models?pageSize=200`, { headers: { "x-goog-api-key": cfg.apiKey } });
    if (!res.ok) throw await httpError(res, "Gemini", "");
    const data = await res.json();
    return (data.models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: { name: string }) => m.name.replace(/^models\//, ""));
  }
  const res = await fetch(`${cfg.baseUrl}/models`, {
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
  });
  if (!res.ok) throw await httpError(res, cfg.provider.label, "");
  const data = await res.json();
  return (data.data ?? []).map((m: { id: string }) => m.id).sort();
}

const PingSchema = z.object({ ok: z.boolean(), saludo: z.string() });

/** Petición mínima para comprobar key y modelo. */
export async function testConnection(cfg: ResolvedAiConfig, tier: "main" | "fast" = "fast") {
  const out = await generateJson(cfg, {
    schema: PingSchema,
    system: "Eres una prueba de conexión.",
    prompt: 'Devuelve {"ok": true, "saludo": "hola"}.',
    tier,
    maxTokens: 2000,
  });
  return out.ok;
}

/** Genera una imagen de fondo (solo proveedores con API de imágenes). */
export async function generateImage(cfg: ResolvedAiConfig, prompt: string, size: "1024x1536" | "1024x1024"): Promise<Buffer> {
  if (!cfg.provider.images || !cfg.provider.imageModel) {
    throw new AiError(`${cfg.provider.label} no genera imágenes desde esta app. Usa una key de OpenAI para el fondo IA.`, 400);
  }
  const res = await fetch(`${cfg.baseUrl}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.provider.imageModel, prompt, size, n: 1 }),
  });
  if (!res.ok) throw await httpError(res, cfg.provider.label, cfg.provider.imageModel);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, "base64");
  const url = data?.data?.[0]?.url;
  if (url) return Buffer.from(await (await fetch(url)).arrayBuffer());
  throw new AiError("La API de imágenes no devolvió ninguna imagen.", 502);
}
