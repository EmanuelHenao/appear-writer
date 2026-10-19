"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PhotoRef } from "@/design/spec";
import { Button, Notice } from "./ui";

/** Tus fotos subidas al servidor (DATA_DIR/uploads/propias). */
export function useOwnPhotos() {
  const [list, setList] = useState<PhotoRef[]>([]);
  const reload = useCallback(async () => {
    const r = await fetch("/api/uploads");
    if (r.ok) setList(await r.json());
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const upload = async (files: File[]): Promise<{ photos: PhotoRef[]; errors: string[] }> => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const r = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    setList((l) => [...data.photos, ...l]);
    return data;
  };
  const remove = async (p: PhotoRef) => {
    const name = p.url.split("/").pop()!;
    await fetch(`/api/uploads/${name}`, { method: "DELETE" });
    setList((l) => l.filter((x) => x.url !== p.url));
  };
  return { list, upload, remove };
}

/**
 * Subir y elegir fotos propias. `selected` son las URL marcadas; con
 * `multiple`, cada clic marca o desmarca; sin él, elige una sola.
 */
export function OwnPhotos({
  selected,
  onToggle,
  multiple = false,
  title = "Tus fotos",
}: {
  selected: string[];
  onToggle: (p: PhotoRef, on: boolean) => void;
  multiple?: boolean;
  title?: string;
}) {
  const own = useOwnPhotos();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function add(files: File[]) {
    setBusy(true);
    setMsg(null);
    try {
      const { photos, errors } = await own.upload(files);
      if (errors.length) setMsg(errors.join(" "));
      // Al subir, la foto nueva queda elegida.
      if (photos[0]) (multiple ? photos : photos.slice(0, 1)).forEach((p) => onToggle(p, true));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted">{title}</span>
        <Button className="h-8 px-3 text-[13px]" busy={busy} onClick={() => input.current?.click()}>
          Subir {multiple ? "fotos" : "una foto"}
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void add(files);
          }}
        />
      </div>
      {msg ? <Notice tone="error">{msg}</Notice> : null}
      {own.list.length ? (
        <div className="scroll-thin grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto">
          {own.list.map((p) => {
            const on = selected.includes(p.url);
            return (
              <div key={p.url} className="group relative">
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={on ? "Quitar esta foto" : "Usar esta foto"}
                  onClick={() => onToggle(p, !on)}
                  className={`block w-full overflow-hidden rounded-md border-2 ${on ? "border-accent" : "border-transparent hover:border-line-strong"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb ?? p.url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                </button>
                <button
                  type="button"
                  aria-label="Borrar la foto del servidor"
                  title="Borrar"
                  onClick={() => {
                    if (on) onToggle(p, false);
                    void own.remove(p);
                  }}
                  className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-ink/85 text-xs text-text group-hover:flex group-focus-within:flex"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted">Sube JPG, PNG o WEBP de hasta 15 MB. Se guardan en tu servidor y no necesitan ninguna key.</p>
      )}
    </div>
  );
}
