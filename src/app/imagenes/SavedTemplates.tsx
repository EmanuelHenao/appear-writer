"use client";

import { useCallback, useEffect, useState } from "react";
import { SlidePreview } from "@/components/SlidePreview";
import { Button, Section, postJson } from "@/components/ui";
import type { Design } from "@/design/compose";
import type { SavedTemplate } from "@/design/saved";
import type { SlideSpec } from "@/design/spec";

/** Las plantillas propias guardadas en el servidor. */
export function useSavedTemplates() {
  const [list, setList] = useState<SavedTemplate[]>([]);

  const reload = useCallback(async () => {
    const r = await fetch("/api/templates");
    if (r.ok) setList(await r.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const save = async (name: string, design: Design, sizeScale: number) => {
    const item = await postJson<SavedTemplate>("/api/templates", { name, design, sizeScale });
    setList((l) => [item, ...l]);
    return item;
  };
  const remove = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setList((l) => l.filter((t) => t.id !== id));
  };
  const rename = async (id: string, name: string) => {
    const r = await fetch(`/api/templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (r.ok) setList((l) => l.map((t) => (t.id === id ? { ...t, name } : t)));
  };
  return { list, save, remove, rename };
}

/** La misma propuesta, comparada sin importar el orden de las claves. */
export function sameDesign(a: Design, b: Design): boolean {
  const norm = (d: Design) =>
    JSON.stringify({ t: d.templateId, p: d.paletteId, f: d.font ?? null, b: d.background, pat: d.background === "patron" ? d.pattern ?? null : null });
  return norm(a) === norm(b);
}

export function SavedTemplatesSection({
  list,
  used,
  setUsed,
  preview,
  onRemove,
  onRename,
  onUse,
}: {
  list: SavedTemplate[];
  used: string[];
  setUsed: (ids: string[]) => void;
  preview: (t: SavedTemplate) => SlideSpec;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  /** Crea las propuestas empezando por las marcadas. */
  onUse: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <Section title="Mis plantillas" note={list.length ? "(las marcadas entran primero en las propuestas)" : undefined}>
      {!list.length ? (
        <p className="text-sm leading-relaxed text-muted">
          Marca con ☆ cualquier propuesta para guardarla como plantilla. Luego podrás usarla con otros textos.
        </p>
      ) : (
        <>
          <div className="flex gap-3 text-xs">
            <button type="button" className="text-accent hover:underline" onClick={() => setUsed(list.map((t) => t.id))}>
              Marcar todas
            </button>
            <button type="button" className="text-accent hover:underline" onClick={() => setUsed([])}>
              Ninguna
            </button>
          </div>
          <ul className="flex flex-col gap-2">
            {list.map((t) => {
              const on = used.includes(t.id);
              return (
                <li key={t.id} className={`flex items-center gap-3 rounded-xl border p-2 ${on ? "border-accent bg-accent-soft" : "border-line"}`}>
                  <input
                    type="checkbox"
                    aria-label={`Usar ${t.name}`}
                    checked={on}
                    onChange={(e) => setUsed(e.target.checked ? [...used, t.id] : used.filter((x) => x !== t.id))}
                  />
                  <SlidePreview spec={preview(t)} width={48} className="flex-none rounded" />
                  <div className="min-w-0 flex-1">
                    {editing === t.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (draft.trim()) onRename(t.id, draft.trim().slice(0, 60));
                          setEditing(null);
                        }}
                      >
                        <input
                          autoFocus
                          value={draft}
                          maxLength={60}
                          onChange={(e) => setDraft(e.target.value)}
                          onBlur={() => setEditing(null)}
                          className="h-8 w-full rounded border border-line bg-ink px-2 text-sm"
                        />
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="block w-full truncate text-left text-sm"
                        title="Cambiar el nombre"
                        onClick={() => {
                          setEditing(t.id);
                          setDraft(t.name);
                        }}
                      >
                        {t.name}
                      </button>
                    )}
                  </div>
                  <button type="button" aria-label={`Borrar ${t.name}`} title="Borrar" className="px-1.5 text-muted hover:text-danger" onClick={() => onRemove(t.id)}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <Button className="h-9 self-start" disabled={!used.length} onClick={onUse}>
            Proponer con {used.length === 1 ? "la marcada" : `las ${used.length} marcadas`}
          </Button>
        </>
      )}
    </Section>
  );
}
