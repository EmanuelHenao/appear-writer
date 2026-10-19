"use client";

import { useState } from "react";
import { Button, Notice, postJson, TextInput } from "@/components/ui";
import type { PhotoRef } from "@/design/spec";

interface Result extends PhotoRef {
  id: string;
  downloadLocation?: string;
}

export function PhotoPicker({
  mode,
  text,
  photo,
  setPhoto,
  defaultQuery,
}: {
  mode: "foto" | "ia";
  text: string;
  photo: PhotoRef | null;
  setPhoto: (p: PhotoRef | null) => void;
  defaultQuery: string;
}) {
  const [q, setQ] = useState(defaultQuery);
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idea, setIdea] = useState("");

  async function search() {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/photos?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResults(data.results);
      if (!data.results.length) setError("No hay fotos para esa búsqueda. Prueba en inglés o con otras palabras.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      setPhoto(await postJson<PhotoRef>("/api/ai/background", { text, idea: idea || undefined }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function choose(r: Result) {
    setPhoto({ url: r.url, thumb: r.thumb, credit: r.credit, creditUrl: r.creditUrl, source: r.source });
    if (r.downloadLocation) void postJson("/api/photos", { downloadLocation: r.downloadLocation }).catch(() => undefined);
  }

  if (mode === "ia") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3">
        <TextInput value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="Idea del fondo (opcional): mar al amanecer…" />
        <Button className="h-9" onClick={generate} busy={busy}>
          {photo?.source === "ia" ? "Generar otro fondo" : "Generar fondo con IA"}
        </Button>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="sunset, people walking…" aria-label="Buscar foto" />
        <Button type="submit" className="h-10" busy={busy}>
          Buscar
        </Button>
      </form>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {results.length ? (
        <div className="scroll-thin grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => choose(r)}
              aria-pressed={photo?.url === r.url}
              title={r.credit}
              className={`overflow-hidden rounded-md border-2 ${photo?.url === r.url ? "border-accent" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.thumb} alt={r.credit ?? "Foto"} className="aspect-[4/5] w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
      {photo?.credit ? (
        <p className="text-xs text-muted">
          Foto de{" "}
          <a href={photo.creditUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {photo.credit}
          </a>
        </p>
      ) : null}
    </div>
  );
}
