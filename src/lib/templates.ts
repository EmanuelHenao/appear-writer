import "server-only";
import { SavedTemplateSchema, type SavedTemplate } from "@/design/saved";
import { dataPath, newId, readJson, writeJson } from "./storage";

const file = () => dataPath("templates.json");

export async function listTemplates(): Promise<SavedTemplate[]> {
  const raw = await readJson<unknown[]>(file(), []);
  // Las entradas que ya no encajan con el esquema se ignoran en vez de romper.
  return raw.flatMap((t) => {
    const r = SavedTemplateSchema.safeParse(t);
    return r.success ? [r.data] : [];
  });
}

export async function addTemplate(t: Pick<SavedTemplate, "name" | "design" | "sizeScale">): Promise<SavedTemplate> {
  const list = await listTemplates();
  const item: SavedTemplate = { id: newId(), createdAt: new Date().toISOString(), ...t };
  await writeJson(file(), [item, ...list]);
  return item;
}

export async function updateTemplate(id: string, patch: { name?: string }): Promise<SavedTemplate | null> {
  const list = await listTemplates();
  const item = list.find((t) => t.id === id);
  if (!item) return null;
  if (patch.name) item.name = patch.name;
  await writeJson(file(), list);
  return item;
}

export async function removeTemplate(id: string): Promise<boolean> {
  const list = await listTemplates();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  await writeJson(file(), next);
  return true;
}
