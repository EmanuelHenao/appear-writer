"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Notice } from "@/components/ui";

interface Item {
  id: string;
  createdAt: string;
  text: string;
  files: string[];
  width: number;
  height: number;
}

interface Book {
  id: string;
  title: string;
  updatedAt: string;
  sources: number;
  coverUrl?: string;
}

export function GalleryPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gallery")
      .then((r) => r.json())
      .then((d) => setItems(d.items))
      .catch(() => setError("No se pudo cargar la galería."));
    fetch("/api/books")
      .then((r) => (r.ok ? r.json() : { books: [] }))
      .then((d) => setBooks(d.books ?? []))
      .catch(() => undefined);
  }, []);

  async function remove(id: string) {
    const res = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    if (res.ok) setItems((list) => list?.filter((i) => i.id !== id) ?? null);
    else setError("No se pudo eliminar.");
    setConfirm(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">Galería</h1>
        <span className="text-sm text-muted">{items ? `${items.length} imágenes` : ""}</span>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}

      {items === null ? (
        <p className="text-muted">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-muted">
          Aún no hay imágenes guardadas. Al descargar una con «Guardar en galería» marcado, aparece aquí.{" "}
          <Link href="/imagenes" className="text-accent hover:underline">
            Crear una imagen
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((it) => (
            <li key={it.id} className="flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-xl border border-line bg-panel">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/gallery/${it.id}/${it.files[0]}`} alt={it.text} className="w-full" style={{ aspectRatio: `${it.width} / ${it.height}` }} loading="lazy" />
                {it.files.length > 1 ? (
                  <span className="absolute right-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 font-mono text-xs">1/{it.files.length}</span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-sm leading-snug">{it.text}</p>
              <p className="font-mono text-xs text-muted">
                {new Date(it.createdAt).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })} · {it.width}×{it.height}
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                <a href={`/api/gallery/${it.id}`} className="text-accent hover:underline">
                  Descargar
                </a>
                <Link href={`/imagenes?desde=${it.id}`} className="text-accent hover:underline">
                  Reabrir
                </Link>
                {confirm === it.id ? (
                  <span className="flex gap-2">
                    <button className="text-danger hover:underline" onClick={() => remove(it.id)}>
                      Sí, eliminar
                    </button>
                    <button className="text-muted hover:underline" onClick={() => setConfirm(null)}>
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button className="text-muted hover:text-danger" onClick={() => setConfirm(it.id)}>
                    Eliminar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-2xl font-bold">Libros</h2>
        {books.length === 0 ? (
          <p className="text-muted">
            Aún no hay libros.{" "}
            <Link href="/libros" className="text-accent hover:underline">
              Crear un libro
            </Link>
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
            {books.map((b) => (
              <li key={b.id}>
                <Link href={`/libros?id=${b.id}`} className="flex flex-col gap-2">
                  <div className="aspect-[148/210] overflow-hidden rounded-lg border border-line bg-panel-2">
                    {b.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center p-3 text-center font-display text-sm">{b.title}</span>
                    )}
                  </div>
                  <span className="text-sm">{b.title}</span>
                  <span className="font-mono text-xs text-muted">{new Date(b.updatedAt).toLocaleDateString("es")}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div>
        <Button onClick={() => location.reload()}>Actualizar</Button>
      </div>
    </main>
  );
}
