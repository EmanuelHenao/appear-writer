import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addTemplate, listTemplates, removeTemplate, updateTemplate } from "@/lib/templates";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "appear-tpl-"));
  process.env.DATA_DIR = dir;
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("mis plantillas", () => {
  it("guarda, renombra y borra, conservando el patrón exacto", async () => {
    const design = {
      templateId: "bold-poster",
      paletteId: "pop",
      font: null,
      background: "patron" as const,
      pattern: { seed: 123, layers: ["truchet" as const, "emoji-lluvia" as const], intensity: "media" as const, scale: 1.2, emojis: "🌻" },
    };
    const t = await addTemplate({ name: "Póster girasol", design, sizeScale: 0.9 });
    expect(await listTemplates()).toEqual([t]);
    expect((await listTemplates())[0].design.pattern).toEqual(design.pattern);
    await updateTemplate(t.id, { name: "Otro nombre" });
    expect((await listTemplates())[0].name).toBe("Otro nombre");
    expect(await removeTemplate(t.id)).toBe(true);
    expect(await listTemplates()).toEqual([]);
  });
});
