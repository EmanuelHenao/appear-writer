import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AiError, generateJson, listModels, parseJsonLoose } from "@/lib/ai/client";
import { resolveAiConfig } from "@/lib/ai/detect";

// Servidor falso que imita Anthropic, OpenAI (y compatibles) y Gemini,
// para comprobar que la app funciona con cualquier tipo de key.

const Schema = z.object({ titulo: z.string(), etiquetas: z.array(z.string()) });
const ANSWER = { titulo: "Hola", etiquetas: ["a", "b"] };

let server: Server;
let base = "";
const seen: { path: string; headers: IncomingMessage["headers"]; body: unknown }[] = [];

beforeAll(async () => {
  server = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    seen.push({ path: req.url ?? "", headers: req.headers, body });
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const auth = req.headers.authorization ?? req.headers["x-api-key"] ?? req.headers["x-goog-api-key"];
    if (String(auth).includes("mala")) return send(401, { error: { type: "authentication_error", message: "invalid key" } });
    if (req.url === "/v1/messages") {
      return send(200, {
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text: JSON.stringify(ANSWER) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      });
    }
    if (req.url === "/v1/models" && req.method === "GET") {
      if (req.headers["x-api-key"]) return send(200, { data: [{ id: "claude-sonnet-5-5", type: "model", display_name: "S", created_at: "2026-01-01T00:00:00Z" }], has_more: false, first_id: "a", last_id: "a" });
      return send(200, { data: [{ id: "modelo-b" }, { id: "modelo-a" }] });
    }
    if (req.url === "/v1/chat/completions") {
      return send(200, { choices: [{ message: { role: "assistant", content: "```json\n" + JSON.stringify(ANSWER) + "\n```" } }] });
    }
    if (req.url?.startsWith("/v1beta/models/gemini-x:generateContent")) {
      return send(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(ANSWER) }] } }] });
    }
    send(404, { error: { message: "no existe" } });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

const req = { schema: Schema, system: "Eres una prueba.", prompt: "Dame JSON." };

describe("cliente de IA para cualquier proveedor", () => {
  it("Anthropic usa el SDK oficial con salida estructurada", async () => {
    const cfg = resolveAiConfig({ apiKey: "sk-ant-buena", baseUrl: base })!;
    expect(await generateJson(cfg, req)).toEqual(ANSWER);
    const call = seen.find((s) => s.path === "/v1/messages")!;
    expect(call.headers["x-api-key"]).toBe("sk-ant-buena");
    expect((call.body as { model: string }).model).toBe("claude-sonnet-5-5");
    expect((call.body as { output_config: { format: { type: string } } }).output_config.format.type).toBe("json_schema");
  });

  it("OpenAI y compatibles usan chat completions y aceptan JSON entre ```", async () => {
    const cfg = resolveAiConfig({ apiKey: "sk-proj-buena", baseUrl: `${base}/v1` })!;
    expect(await generateJson(cfg, { ...req, tier: "fast" })).toEqual(ANSWER);
    const call = seen.filter((s) => s.path === "/v1/chat/completions").at(-1)!;
    expect(call.headers.authorization).toBe("Bearer sk-proj-buena");
    expect((call.body as { model: string }).model).toBe("gpt-5-mini");
  });

  it("un servidor local compatible funciona sin key", async () => {
    const cfg = resolveAiConfig({ provider: "compatible", baseUrl: `${base}/v1`, mainModel: "llama3" })!;
    expect(await generateJson(cfg, req)).toEqual(ANSWER);
    expect(await listModels(cfg)).toEqual(["modelo-a", "modelo-b"]);
  });

  it("Gemini usa generateContent con la key en cabecera", async () => {
    const cfg = resolveAiConfig({ apiKey: "AIza-buena", baseUrl: `${base}/v1beta`, mainModel: "gemini-x" })!;
    expect(await generateJson(cfg, req)).toEqual(ANSWER);
    const call = seen.find((s) => s.path.startsWith("/v1beta/models/gemini-x"))!;
    expect(call.headers["x-goog-api-key"]).toBe("AIza-buena");
  });

  it("una key inválida da un mensaje claro en cada proveedor", async () => {
    await expect(generateJson(resolveAiConfig({ apiKey: "sk-ant-mala", baseUrl: base })!, req)).rejects.toThrow(/no es válida/);
    await expect(generateJson(resolveAiConfig({ apiKey: "sk-mala", baseUrl: `${base}/v1` })!, req)).rejects.toThrow(/no es válida/);
    await expect(generateJson(resolveAiConfig({ apiKey: "AIza-mala", baseUrl: `${base}/v1beta`, mainModel: "gemini-x" })!, req)).rejects.toThrow(/no es válida/);
  });

  it("un modelo inexistente se explica", async () => {
    const cfg = resolveAiConfig({ apiKey: "AIza-buena", baseUrl: `${base}/v1beta`, mainModel: "no-existe" })!;
    await expect(generateJson(cfg, req)).rejects.toThrow(/no existe/);
  });

  it("lista los modelos de Anthropic", async () => {
    expect(await listModels(resolveAiConfig({ apiKey: "sk-ant-buena", baseUrl: base })!)).toEqual(["claude-sonnet-5-5"]);
  });

  it("parseJsonLoose valida contra el esquema", () => {
    expect(parseJsonLoose('Aquí está: {"titulo":"x","etiquetas":[]} gracias', Schema)).toEqual({ titulo: "x", etiquetas: [] });
    expect(() => parseJsonLoose('{"titulo": 1}', Schema)).toThrow(AiError);
    expect(() => parseJsonLoose("sin json", Schema)).toThrow(AiError);
  });
});
