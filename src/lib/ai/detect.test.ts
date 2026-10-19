import { describe, expect, it } from "vitest";
import { detectProvider, maskKey, resolveAiConfig } from "./detect";

describe("detección de proveedor", () => {
  it.each([
    ["sk-ant-api03-abc", "anthropic"],
    ["sk-or-v1-abc", "openrouter"],
    ["AIzaSyABC", "gemini"],
    ["gsk_abc", "groq"],
    ["xai-abc", "xai"],
    ["sk-proj-abc", "openai"],
    ["cualquier-otra", "compatible"],
  ])("%s → %s", (key, id) => {
    expect(detectProvider(key)).toBe(id);
  });

  it("sin key no hay proveedor", () => {
    expect(detectProvider("  ")).toBeNull();
    expect(resolveAiConfig({ apiKey: "" })).toBeNull();
  });

  it("usa los modelos del proveedor si no se indican", () => {
    const c = resolveAiConfig({ apiKey: "sk-ant-x" })!;
    expect(c.provider.id).toBe("anthropic");
    expect(c.mainModel).toBe("claude-sonnet-5-5");
    expect(c.fastModel).toBe("claude-haiku-5-5");
  });

  it("un servicio compatible necesita URL y modelo", () => {
    expect(resolveAiConfig({ apiKey: "abc" })).toBeNull();
    const c = resolveAiConfig({ apiKey: "", provider: "compatible", baseUrl: "http://localhost:11434/v1/", mainModel: "llama3" })!;
    expect(c.baseUrl).toBe("http://localhost:11434/v1");
    expect(c.fastModel).toBe("llama3");
  });

  it("respeta el proveedor elegido a mano", () => {
    const c = resolveAiConfig({ apiKey: "sk-123", provider: "deepseek" })!;
    expect(c.baseUrl).toBe("https://api.deepseek.com/v1");
  });

  it("oculta la key", () => {
    expect(maskKey("sk-ant-api03-1234567890")).toBe("sk-ant…7890");
  });
});
