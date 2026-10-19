"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "@/components/icons";
import { OwnPhotos } from "@/components/OwnPhotos";
import { StepHead, StudioLayout, type Step } from "@/components/StudioLayout";
import { Button, Check, Choice, Notice, Section, SuggestDot, TextInput, saveBlob } from "@/components/ui";
import { useSettings } from "@/components/useSettings";
import { describeSource, type Source } from "@/book/model";
import { BOOK_PALETTES, CHAPTER_RULES, chapterRuleOf, COVERS, PAGE_SIZES, suggestedBookOptions, type BookOptions } from "@/book/options";
import { BOOK_FONT_CHOICES, FONTS, fontStack } from "@/design/fonts";
import type { PhotoRef } from "@/design/spec";

interface Book {
  id: string;
  sources: Source[];
  options: BookOptions;
  ai: { chapterTitles?: Record<string, string>; corrections?: Record<string, string>; breaks?: Record<string, unknown>; titleSuggestion?: { titulo: string; subtitulo: string }; coverReason?: string };
  stock: { query: string; photos: PhotoRef[] };
  lastPages?: number;
}

type AiStep = "chapters" | "spelling" | "title" | "cover";

const AI_STEPS: { id: AiStep; label: string; hint: string }[] = [
  { id: "chapters", label: "Organizar en capítulos", hint: "Pone títulos a los capítulos y corta los textos sin títulos." },
  { id: "spelling", label: "Corregir ortografía", hint: "Solo tildes y faltas; el original se conserva." },
  { id: "title", label: "Sugerir título", hint: "Propone título y subtítulo; puedes editarlos." },
  { id: "cover", label: "Diseñar portada", hint: "Elige portada y paleta según el contenido." },
];

const LAST_KEY = "appear:libro";

export function BookStudio() {
  const { settings } = useSettings();
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [version, setVersion] = useState(0);
  const [pages, setPages] = useState<number | null>(null);
  // Visor de la vista previa (lo maneja el propio documento del libro).
  const frame = useRef<HTMLIFrameElement>(null);
  const wanted = useRef<{ cols: 1 | 2; zoom: number }>({ cols: 2, zoom: 0 });
  const [view, setView] = useState({ cols: 2 as 1 | 2, zoom: 1, fit: true, page: 1 });
  const [shown, setShown] = useState(0);
  const [paste, setPaste] = useState({ open: false, text: "", title: "" });
  const [drag, setDrag] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hasAi = !!settings?.ai.resolved;
  const hasPhotos = !!settings && (settings.photos.unsplash || settings.photos.pexels);

  // Carga el libro de ?id= o el último abierto.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? safeGet(LAST_KEY);
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    fetch(`/api/books/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b: Book | null) => {
        if (b) setBook(b);
        else safeSet(LAST_KEY, "");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (!frame.current || e.source !== frame.current.contentWindow) return;
      if (e.data?.type === "book-ready") {
        setPages(e.data.pages);
        // La vista elegida se mantiene al recargar la vista previa.
        const w = wanted.current;
        if (w.cols !== 2 || w.zoom) frame.current.contentWindow?.postMessage({ type: "book-control", cols: w.cols, zoom: w.zoom }, "*");
      }
      if (e.data?.type === "book-view") {
        setShown(e.data.shown);
        setView({ cols: e.data.cols, zoom: e.data.zoom, fit: wanted.current.zoom === 0, page: e.data.page });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function control(msg: { cols?: 1 | 2; zoom?: number; goto?: number }) {
    if (msg.cols) wanted.current.cols = msg.cols;
    if (msg.zoom !== undefined) wanted.current.zoom = msg.zoom;
    frame.current?.contentWindow?.postMessage({ type: "book-control", ...msg }, "*");
  }

  const suggested = useMemo(() => (book ? suggestedBookOptions(book.sources) : null), [book]);
  const hasChats = !!book?.sources.some((s) => s.kind === "whatsapp");
  const hasImages = !!book?.sources.some((s) => (s.meta.images ?? 0) > 0);

  async function ensureBook(): Promise<Book> {
    if (book) return book;
    const res = await fetch("/api/books", { method: "POST" });
    const b = await res.json();
    setBook(b);
    safeSet(LAST_KEY, b.id);
    return b;
  }

  async function addSources(files: File[], text?: { text: string; title: string }) {
    setBusy("import");
    setMsg(null);
    try {
      const b = await ensureBook();
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      if (text?.text.trim()) {
        form.append("text", text.text);
        if (text.title) form.append("title", text.title);
      }
      const res = await fetch(`/api/books/${b.id}/sources`, { method: "POST", body: form });
      const data = await res.json();
      if (data.book) {
        setBook(data.book);
        safeSet(LAST_KEY, data.book.id);
        setVersion((v) => v + 1);
      }
      if (data.errors?.length) setMsg({ tone: "error", text: data.errors.join(" ") });
      else if (!res.ok) setMsg({ tone: "error", text: data.error });
      else setPaste({ open: false, text: "", title: "" });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      if (!book) return;
      const res = await fetch(`/api/books/${book.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (res.ok) {
        setBook(data);
        setVersion((v) => v + 1);
      } else setMsg({ tone: "error", text: data.error });
    },
    [book],
  );

  /** Cambia una opción al momento y la guarda medio segundo después. */
  function setOptions(next: BookOptions) {
    if (!book) return;
    setBook({ ...book, options: next });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void patch({ options: next }), 500);
  }

  const o = book?.options;
  const up = <K extends keyof BookOptions>(k: K, v: BookOptions[K]) => o && setOptions({ ...o, [k]: v });
  const upContent = (patchC: Partial<BookOptions["content"]>) => o && setOptions({ ...o, content: { ...o.content, ...patchC } });
  const upCover = (patchC: Partial<BookOptions["cover"]>) => o && setOptions({ ...o, cover: { ...o.cover, ...patchC } });

  async function runAi(step: AiStep) {
    if (!book) return;
    setBusy(`ai-${step}`);
    setMsg({ tone: "info", text: step === "spelling" ? "Corrigiendo… en libros largos tarda unos minutos." : "Pidiendo la propuesta a la IA…" });
    try {
      const res = await fetch(`/api/books/${book.id}/ai`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBook(data);
      setVersion((v) => v + 1);
      setMsg({ tone: "ok", text: "Listo. Revisa el resultado en la vista previa; desmarca la casilla para quitarlo." });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function toggleAi(step: AiStep, on: boolean) {
    if (!o || !book) return;
    const done =
      step === "chapters" ? !!book.ai.chapterTitles : step === "spelling" ? !!book.ai.corrections : step === "title" ? !!book.ai.titleSuggestion : !!book.ai.coverReason;
    if (on && !done) {
      void runAi(step);
      return;
    }
    setOptions({ ...o, ai: { ...o.ai, [step]: on } });
  }

  async function searchStock(q: string) {
    if (!book) return;
    setBusy("stock");
    try {
      const res = await fetch(`/api/photos?q=${encodeURIComponent(q)}&forma=horizontal`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const photos: PhotoRef[] = data.results.slice(0, 12).map((r: PhotoRef) => ({ url: r.url, thumb: r.thumb, credit: r.credit, creditUrl: r.creditUrl, source: r.source }));
      // Tus fotos subidas se conservan; las del banco se cambian por las nuevas.
      await patch({ stock: { query: q, photos: [...book.stock.photos.filter((p) => p.source === "subida"), ...photos].slice(0, 40) } });
      if (o && !o.content.stockPhotos) setOptions({ ...o, content: { ...o.content, stockPhotos: true } });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!book || !o) return;
    const formats = (["pdf", "epub", "png"] as const).filter((f) => o.outputs[f]);
    if (!formats.length) {
      setMsg({ tone: "error", text: "Marca al menos un formato de salida." });
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      await patch({ options: o });
    }
    setBusy("generate");
    try {
      for (const f of formats) {
        setMsg({ tone: "info", text: `Generando ${f === "png" ? "las imágenes por página" : f.toUpperCase()}…` });
        const res = await fetch(`/api/books/${book.id}/export`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format: f }) });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "No se pudo generar.");
        const n = res.headers.get("X-Pages");
        if (n) setPages(Number(n));
        await saveBlob(res, `libro.${f === "png" ? "zip" : f}`);
      }
      setMsg({ tone: "ok", text: `Listo: ${formats.map((f) => (f === "png" ? "PNG por página" : f.toUpperCase())).join(", ")}.` });
    } catch (e) {
      setMsg({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  function newBook() {
    safeSet(LAST_KEY, "");
    setBook(null);
    setPages(null);
    setMsg(null);
    window.history.replaceState(null, "", "/libros");
  }

  if (loading) return <main className="p-8 text-muted">Cargando…</main>;

  const sug = suggested;
  const S = <T,>(a: T, b: T | undefined) => (b !== undefined && JSON.stringify(a) === JSON.stringify(b) ? true : undefined);
  const hasSources = !!book?.sources.length;
  const aiOn = o ? AI_STEPS.filter((s) => o.ai[s.id]).length : 0;
  const outputsLabel = o
    ? (["pdf", "epub", "png"] as const)
        .filter((f) => o.outputs[f])
        .map((f) => (f === "png" ? "PNG por página" : f.toUpperCase()))
        .join(" · ")
    : "";

  const steps: Step[] = [
    { id: "paso-1", label: "Fuentes", done: hasSources, current: !hasSources },
    { id: "paso-2", label: "Opciones del libro", current: hasSources },
  ];

  const footer = (
    <div className="flex flex-col gap-2">
      {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
      <Button variant="primary" className="w-full" disabled={!hasSources} busy={busy === "generate"} onClick={generate}>
        Generar libro
      </Button>
      <span className="text-center text-xs text-muted">
        {hasSources && o
          ? [outputsLabel || "Marca un formato de salida", pages ? `${pages.toLocaleString("es")} págs.` : "", PAGE_SIZES[o.pageSize].label].filter(Boolean).join(" · ")
          : "Añade una fuente para empezar"}
      </span>
    </div>
  );

  const dropProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(true);
    },
    onDragLeave: () => setDrag(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) void addSources(files);
    },
  };
  const pickButtons = (small: boolean) => (
    <div className="flex flex-wrap justify-center gap-2">
      <Button className={small ? "h-8 px-3 text-[13px]" : "h-9"} onClick={() => fileInput.current?.click()} busy={busy === "import"}>
        {small ? "Elegir" : "Elegir archivos"}
      </Button>
      <Button className={small ? "h-8 px-3 text-[13px]" : "h-9"} onClick={() => setPaste((p) => ({ ...p, open: !p.open }))}>
        {small ? "Pegar texto" : "Pegar un texto"}
      </Button>
    </div>
  );

  const aside = (
    <>
      {/* Paso 1 · Fuentes */}
      <section id="paso-1" className="flex scroll-mt-4 flex-col gap-3">
        <StepHead label="Paso 1 · Fuentes">
          {book ? (
            <button onClick={newBook} className="text-xs text-accent hover:underline">
              Empezar otro libro
            </button>
          ) : null}
        </StepHead>
        <h1 className="font-display text-2xl font-bold leading-[1.1] tracking-tight">Tus textos, en orden</h1>
        {book?.sources.length ? (
          <ol className="flex flex-col gap-2">
            {book.sources.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-ink py-2.5 pl-3 pr-1.5">
                <span className="flex-none font-mono text-xs text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  <div className="mt-0.5 text-xs text-muted">{describeSource(s)}</div>
                </div>
                <div className="flex flex-none items-center text-sm">
                  <IconBtn label="Subir" disabled={i === 0} onClick={() => patch({ order: move(book.sources, i, -1) })}>
                    ↑
                  </IconBtn>
                  <IconBtn label="Bajar" disabled={i === book.sources.length - 1} onClick={() => patch({ order: move(book.sources, i, 1) })}>
                    ↓
                  </IconBtn>
                  {confirmRemove === s.id ? (
                    <button className="px-1 text-xs text-danger hover:underline" onClick={() => patch({ removeSource: s.id }).then(() => setConfirmRemove(null))}>
                      Quitar
                    </button>
                  ) : (
                    <IconBtn label={`Quitar ${s.name}`} onClick={() => setConfirmRemove(s.id)}>
                      ×
                    </IconBtn>
                  )}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
        {hasSources ? (
          <div
            {...dropProps}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-dashed px-3 py-2.5 text-[13px] text-muted ${drag ? "border-accent bg-accent-soft" : "border-line-strong"}`}
          >
            <span>Arrastra más archivos aquí</span>
            {pickButtons(true)}
          </div>
        ) : (
          <div
            {...dropProps}
            className={`flex flex-col items-center gap-3 rounded-xl border border-dashed p-6 text-center leading-relaxed text-muted ${drag ? "border-accent bg-accent-soft" : "border-line-strong"}`}
          >
            <span>Arrastra aquí un chat de WhatsApp (.txt o .zip), .docx, .pdf o .txt</span>
            {pickButtons(false)}
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".txt,.zip,.docx,.pdf,.md"
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void addSources(files);
          }}
        />
        {paste.open ? (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-ink p-3">
            <TextInput value={paste.title} onChange={(e) => setPaste({ ...paste, title: e.target.value })} placeholder="Título (opcional)" aria-label="Título del texto" />
            <textarea
              rows={8}
              value={paste.text}
              onChange={(e) => setPaste({ ...paste, text: e.target.value })}
              placeholder="Pega aquí poemas, notas o un capítulo. Separa párrafos con una línea en blanco."
              aria-label="Texto"
              className="rounded-lg border border-line bg-panel p-3 text-sm leading-relaxed"
            />
            <Button variant="primary" className="h-9" disabled={!paste.text.trim()} busy={busy === "import"} onClick={() => addSources([], paste)}>
              Añadir texto
            </Button>
          </div>
        ) : null}
        {!hasSources ? (
          <p className="text-xs leading-relaxed text-muted">
            En WhatsApp: abre el chat › Más › Exportar chat. Con «Incluir archivos» llegan también las fotos (sube el .zip).
          </p>
        ) : null}
      </section>

      {/* Paso 2 · Opciones */}
      <section id="paso-2" className="flex scroll-mt-4 flex-col">
        <StepHead label="Paso 2 · Opciones">
          {o && hasSources ? (
            <span className="flex items-center gap-3">
              <button type="button" onClick={() => patch({ resetOptions: true })} className="text-xs text-accent hover:underline">
                Volver a lo sugerido
              </button>
              <span className="whitespace-nowrap rounded-full border border-suggest-line px-2 py-0.5 text-[11px] text-suggest">● sugerido</span>
            </span>
          ) : null}
        </StepHead>
        {!o || !book || !hasSources ? (
          <p className="py-4 text-sm leading-relaxed text-muted">Cuando añadas una fuente, aquí aparecen todas las opciones del libro con los valores que te sugerimos.</p>
        ) : (
          <div className="mt-2">
            <Section title="Tamaño de página" defaultOpen summary={`${PAGE_SIZES[o.pageSize].label}${o.bleed ? " · con sangrado" : ""}`} suggested={o.pageSize === sug?.pageSize && o.bleed === sug?.bleed}>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(PAGE_SIZES) as (keyof typeof PAGE_SIZES)[]).map((k) => (
                  <Choice key={k} name="tam" value={k} checked={o.pageSize === k} onSelect={() => up("pageSize", k)} suggested={sug?.pageSize === k}>
                    <span className="text-sm">{PAGE_SIZES[k].label}</span>
                  </Choice>
                ))}
              </div>
              <p className="text-xs text-muted">{PAGE_SIZES[o.pageSize].hint}</p>
              <Check id="bleed" checked={o.bleed} onChange={(v) => up("bleed", v)} suggested={S(true, sug?.bleed)} hint="Añade 3 mm por lado para que la imprenta corte sin bordes blancos.">
                Sangrado para imprenta
              </Check>
            </Section>

            <Section title="Tipografía" summary={`${FONTS[o.font].label} · ${FONT_SCALE_LABEL[o.fontScale]}`} suggested={o.font === sug?.font && o.fontScale === sug?.fontScale}>
              <div className="grid grid-cols-2 gap-2">
                {BOOK_FONT_CHOICES.map((f) => (
                  <Choice key={f} name="font" value={f} checked={o.font === f} onSelect={() => up("font", f as BookOptions["font"])} suggested={sug?.font === f}>
                    <span className="block text-[19px] leading-tight" style={{ fontFamily: fontStack(f) }}>
                      {FONTS[f].label}
                    </span>
                    <span className="block text-xs text-muted">{FONTS[f].hint}</span>
                  </Choice>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted">Tamaño:</span>
                {(["pequena", "normal", "grande"] as const).map((s) => (
                  <label key={s} className="flex items-center gap-2">
                    <input type="radio" name="fsize" checked={o.fontScale === s} onChange={() => up("fontScale", s)} />
                    {s === "pequena" ? "Pequeña" : s === "normal" ? "Normal" : "Grande"} {sug?.fontScale === s ? <SuggestDot /> : null}
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Paleta" summary={BOOK_PALETTES.find((p) => p.id === o.palette)?.label ?? o.palette} suggested={o.palette === sug?.palette}>
              <div className="grid grid-cols-2 gap-2">
                {BOOK_PALETTES.map((p) => (
                  <Choice key={p.id} name="bpal" value={p.id} checked={o.palette === p.id} onSelect={() => up("palette", p.id)} suggested={sug?.palette === p.id}>
                    <span className="mb-1 flex h-5 overflow-hidden rounded">
                      {[p.deep, p.accent, p.paper].map((c, i) => (
                        <span key={i} className="flex-1" style={{ background: c }} />
                      ))}
                    </span>
                    <span className="text-xs">{p.label}</span>
                  </Choice>
                ))}
              </div>
            </Section>

            <Section title="Portada" summary={COVERS.find((c) => c.id === o.cover.template)?.label ?? ""} suggested={o.ai.cover && book.ai.coverReason ? "ia" : o.cover.template === sug?.cover.template}>
              <div className="grid grid-cols-2 gap-2">
                {COVERS.map((c) => (
                  <Choice key={c.id} name="cover" value={c.id} checked={o.cover.template === c.id} onSelect={() => upCover({ template: c.id })} suggested={sug?.cover.template === c.id}>
                    <span className="block text-sm">{c.label}</span>
                    <span className="block text-xs text-muted">{c.hint}</span>
                  </Choice>
                ))}
              </div>
              {o.ai.cover && book.ai.coverReason ? <p className="text-xs text-muted">IA: {book.ai.coverReason}</p> : null}
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Título {o.ai.title && book.ai.titleSuggestion ? <SuggestDot kind="ia" /> : null}</span>
                <TextInput value={o.cover.title} maxLength={120} onChange={(e) => upCover({ title: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Subtítulo</span>
                <TextInput value={o.cover.subtitle} maxLength={160} onChange={(e) => upCover({ subtitle: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Autor o dedicado a</span>
                <TextInput value={o.cover.author} maxLength={120} onChange={(e) => upCover({ author: e.target.value })} placeholder="Opcional" />
              </label>
            </Section>

            <Section title="Contenido" summary={contentSummary(o, hasChats)} suggested={S(o.content, sug?.content)}>
              <div className="grid grid-cols-2 gap-2.5">
                {hasChats ? (
                  <>
                    <fieldset className="col-span-2 flex flex-col gap-2">
                      <legend className="mb-1 text-sm text-muted">Cómo se ven los mensajes</legend>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ["pagina", "Uno por página", { onePerPage: true, bubbles: false }],
                            ["burbujas", "Burbujas de chat", { onePerPage: false, bubbles: true }],
                            ["seguidos", "Seguidos", { onePerPage: false, bubbles: false }],
                          ] as const
                        ).map(([id, label, value]) => {
                          const current = o.content.bubbles ? "burbujas" : o.content.onePerPage ? "pagina" : "seguidos";
                          const sugg = sug ? (sug.content.bubbles ? "burbujas" : sug.content.onePerPage ? "pagina" : "seguidos") : "";
                          return (
                            <Choice key={id} name="msgstyle" value={id} checked={current === id} suggested={sugg === id} onSelect={() => upContent(value)}>
                              <span className="text-sm">{label}</span>
                            </Choice>
                          );
                        })}
                      </div>
                      {o.content.bubbles ? (
                        <label className="flex items-center gap-2 text-sm">
                          <span className="text-muted">A la derecha (tus mensajes):</span>
                          <select
                            value={o.content.rightAuthor}
                            onChange={(e) => upContent({ rightAuthor: e.target.value })}
                            className="h-9 rounded-lg border border-line bg-ink px-2"
                          >
                            <option value="">Nadie</option>
                            {Array.from(new Set(book.sources.flatMap((s) => s.meta.participants ?? []))).map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </fieldset>
                    <fieldset className="col-span-2 flex flex-col gap-2">
                      <legend className="mb-1 text-sm text-muted">Capítulos</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {CHAPTER_RULES.map((r) => (
                          <Choice
                            key={r.id}
                            name="caprule"
                            value={r.id}
                            checked={chapterRuleOf(o) === r.id}
                            suggested={sug ? chapterRuleOf(sug) === r.id : false}
                            onSelect={() => upContent({ chapterRule: r.id, chaptersByMonth: r.id === "mes" })}
                          >
                            <span className="block text-sm">{r.label}</span>
                            <span className="block text-xs text-muted">{r.hint}</span>
                          </Choice>
                        ))}
                      </div>
                      {chapterRuleOf(o) === "silencio" ? (
                        <label className="flex items-center gap-2 text-sm">
                          <span className="text-muted">Nuevo capítulo tras</span>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={o.content.silenceDays}
                            onChange={(e) => upContent({ silenceDays: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
                            className="h-9 w-20 rounded-lg border border-line bg-ink px-2 text-center font-mono"
                            aria-label="Días de silencio"
                          />
                          <span className="text-muted">días sin mensajes</span>
                          {o.content.silenceDays === 14 ? <SuggestDot /> : null}
                        </label>
                      ) : null}
                    </fieldset>
                    <Check id="c-name" checked={o.content.showName} onChange={(v) => upContent({ showName: v })} suggested={S(true, sug?.content.showName)}>
                      Nombre de quien escribe
                    </Check>
                    <Check id="c-date" checked={o.content.showDate} onChange={(v) => upContent({ showDate: v })} suggested={S(true, sug?.content.showDate)}>
                      Fecha del mensaje
                    </Check>
                    <Check id="c-time" checked={o.content.showTime} onChange={(v) => upContent({ showTime: v })}>
                      Hora del mensaje
                    </Check>
                  </>
                ) : null}
                <Check id="c-orn" checked={o.content.ornaments} onChange={(v) => upContent({ ornaments: v })} suggested={S(true, sug?.content.ornaments)}>
                  Ornamentos tipográficos
                </Check>
                <Check id="c-title" checked={o.content.titlePage} onChange={(v) => upContent({ titlePage: v })} suggested={S(true, sug?.content.titlePage)}>
                  Portadilla
                </Check>
                <Check id="c-toc" checked={o.content.toc} onChange={(v) => upContent({ toc: v })} suggested={S(true, sug?.content.toc)}>
                  Índice
                </Check>
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Dedicatoria (opcional)</span>
                <textarea
                  rows={2}
                  value={o.content.dedication}
                  maxLength={400}
                  onChange={(e) => upContent({ dedication: e.target.value })}
                  className="rounded-lg border border-line bg-ink p-2.5 text-sm"
                  placeholder="Para ti, que estuviste en cada mensaje."
                />
              </label>
            </Section>

            <Section title="Imágenes" summary={[o.content.chatPhotos && "Fotos del chat", o.content.stockPhotos && "Fotos en capítulos"].filter(Boolean).join(" · ") || "Solo texto"} suggested={o.content.chatPhotos === sug?.content.chatPhotos && o.content.stockPhotos === sug?.content.stockPhotos}>
              <div className="grid grid-cols-2 gap-2.5">
                <Check id="i-chat" checked={o.content.chatPhotos} disabled={!hasImages} onChange={(v) => upContent({ chatPhotos: v })} suggested={S(true, sug?.content.chatPhotos)} hint={!hasImages ? "Sube el .zip del chat para tener fotos" : undefined}>
                  Fotos del chat
                </Check>
                <Check id="i-stock" checked={o.content.stockPhotos} disabled={!book.stock.photos.length} onChange={(v) => upContent({ stockPhotos: v })} hint={book.stock.photos.length ? `${book.stock.photos.length} elegidas, una por capítulo` : "Elige o sube fotos abajo"}>
                  Fotos en los capítulos
                </Check>
                <Check id="i-none" checked={!o.content.chatPhotos && !o.content.stockPhotos} onChange={(v) => v && upContent({ chatPhotos: false, stockPhotos: false })}>
                  Solo texto
                </Check>
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-line bg-ink/40 p-3 text-sm">
                <OwnPhotos
                  multiple
                  title="Tus fotos para las aperturas de capítulo"
                  selected={book.stock.photos.map((p) => p.url)}
                  onToggle={(p, on) => {
                    const photos = on ? [...book.stock.photos.filter((x) => x.url !== p.url), p] : book.stock.photos.filter((x) => x.url !== p.url);
                    void patch({ stock: { query: book.stock.query, photos: photos.slice(0, 40) } }).then(() => {
                      if (on && !o.content.stockPhotos) setOptions({ ...o, content: { ...o.content, stockPhotos: true } });
                    });
                  }}
                />
                {hasPhotos ? <StockSearch book={book} busy={busy === "stock"} onSearch={searchStock} /> : null}
              </div>
            </Section>

            <Section title="Ayuda de la IA" summary={aiOn ? `${aiOn} ${aiOn === 1 ? "activa" : "activas"}` : "Apagada"}>
              {!hasAi ? (
                <p className="text-sm text-muted">
                  Añade una API key en{" "}
                  <Link href="/ajustes" className="text-accent hover:underline">
                    Ajustes
                  </Link>{" "}
                  para usarla.
                </p>
              ) : null}
              <div className="flex flex-col gap-2.5">
                {AI_STEPS.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-2">
                    <Check id={`ai-${s.id}`} checked={o.ai[s.id]} disabled={!hasAi || !!busy} onChange={(v) => toggleAi(s.id, v)} hint={s.hint}>
                      {s.label}
                    </Check>
                    {o.ai[s.id] ? (
                      <button className="flex-none text-xs text-accent hover:underline disabled:opacity-50" disabled={!!busy} onClick={() => runAi(s.id)}>
                        {busy === `ai-${s.id}` ? "…" : "Repetir"}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              {o.ai.spelling && book.ai.corrections ? <p className="text-xs text-muted">{Object.keys(book.ai.corrections).length} textos corregidos.</p> : null}
            </Section>

            <Section title="Salida" summary={outputsLabel || "Ninguna"} suggested={S(o.outputs, sug?.outputs)}>
              <div className="grid grid-cols-3 gap-2.5">
                <Check id="o-pdf" checked={o.outputs.pdf} onChange={(v) => up("outputs", { ...o.outputs, pdf: v })} suggested={S(true, sug?.outputs.pdf)}>
                  PDF imprenta
                </Check>
                <Check id="o-epub" checked={o.outputs.epub} onChange={(v) => up("outputs", { ...o.outputs, epub: v })} suggested={S(true, sug?.outputs.epub)}>
                  EPUB
                </Check>
                <Check id="o-png" checked={o.outputs.png} onChange={(v) => up("outputs", { ...o.outputs, png: v })}>
                  PNG por página
                </Check>
              </div>
            </Section>
          </div>
        )}
      </section>
    </>
  );

  const pageLabel = !shown ? "" : view.cols === 2 && view.page > 1 ? `${view.page}–${Math.min(view.page + 1, shown)}` : String(view.page);
  const step = (dir: 1 | -1) => {
    const p = view.page;
    const next =
      view.cols === 1 ? p + dir : dir === 1 ? (p === 1 ? 2 : p + 2) : p <= 2 ? 1 : p - 2;
    control({ goto: Math.max(1, Math.min(shown, next)) });
  };

  return (
    <StudioLayout
      steps={steps}
      navExtra={
        <Link href="/galeria" className="text-accent hover:underline">
          Libros guardados
        </Link>
      }
      aside={aside}
      footer={footer}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Paso 3 · Vista previa{pages ? ` · ${pages.toLocaleString("es")} págs.` : ""}</div>
          <h2 className="mt-1 font-display text-xl font-bold">{o?.cover.title || "Tu libro"}</h2>
        </div>
        {hasSources ? (
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Vista" className="flex gap-0.5 rounded-lg bg-panel p-[3px] text-[13px]">
              {([1, 2] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={view.cols === c}
                  onClick={() => control({ cols: c })}
                  className={`rounded-md px-3 py-1.5 ${view.cols === c ? "bg-panel-2 text-text" : "text-muted hover:text-text"}`}
                >
                  {c === 1 ? "Página" : "Doble página"}
                </button>
              ))}
            </div>
            <div className="flex items-center">
              <IconBtn label="Página anterior" disabled={view.page <= 1} onClick={() => step(-1)}>
                <ChevronLeft />
              </IconBtn>
              <span
                className="min-w-20 text-center font-mono text-xs tabular-nums"
                title={pages && shown && pages > shown ? `La vista previa muestra las primeras ${shown} de ${pages} páginas` : undefined}
              >
                {pageLabel} / {shown || "…"}
              </span>
              <IconBtn label="Página siguiente" disabled={!shown || (view.cols === 2 && view.page > 1 ? view.page + 1 : view.page) >= shown} onClick={() => step(1)}>
                <ChevronRight />
              </IconBtn>
            </div>
            <div className="flex items-center">
              <IconBtn label="Alejar" onClick={() => control({ zoom: Math.max(0.2, view.zoom / 1.25) })}>
                <Minus />
              </IconBtn>
              <button
                type="button"
                onClick={() => control({ zoom: 0 })}
                title="Ajustar a la ventana"
                className={`h-7 min-w-14 rounded-md px-1.5 font-mono text-xs tabular-nums hover:bg-panel-2 ${view.fit ? "text-muted" : "text-text"}`}
              >
                {view.fit ? "Ajustar" : `${Math.round(view.zoom * 100)}%`}
              </button>
              <IconBtn label="Acercar" onClick={() => control({ zoom: Math.min(3, view.zoom * 1.25) })}>
                <Plus />
              </IconBtn>
            </div>
          </div>
        ) : null}
      </div>
      <div className="min-h-[520px] flex-1 overflow-hidden rounded-2xl bg-panel lg:min-h-0">
        {hasSources && book ? (
          <iframe ref={frame} key={version} title="Vista previa del libro" src={`/api/books/${book.id}/preview?limite=40&v=${version}`} className="h-full min-h-[520px] w-full border-0 lg:min-h-0" />
        ) : (
          <div className="flex h-full min-h-[520px] items-center justify-center p-10 text-center text-muted">Aquí aparecerán las páginas de tu libro, a doble página.</div>
        )}
      </div>
    </StudioLayout>
  );
}

function contentSummary(o: BookOptions, hasChats: boolean): string {
  if (hasChats) {
    const style = o.content.bubbles ? "Burbujas" : o.content.onePerPage ? "Uno por página" : "Seguidos";
    const rule = CHAPTER_RULES.find((r) => r.id === chapterRuleOf(o))?.label.toLowerCase() ?? "";
    return `${style} · ${rule}`;
  }
  return [o.content.titlePage && "Portadilla", o.content.toc && "Índice", o.content.ornaments && "Ornamentos"].filter(Boolean).join(" · ") || "Solo el texto";
}

const FONT_SCALE_LABEL: Record<BookOptions["fontScale"], string> = { pequena: "pequeña", normal: "normal", grande: "grande" };

function StockSearch({ book, busy, onSearch }: { book: Book; busy: boolean; onSearch: (q: string) => void }) {
  const [q, setQ] = useState(book.stock.query);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel-2 p-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) onSearch(q.trim());
        }}
      >
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="friends laughing, sea, city at night…" aria-label="Buscar fotos para los capítulos" />
        <Button type="submit" className="h-10" busy={busy}>
          Buscar
        </Button>
      </form>
      {book.stock.photos.length ? (
        <div className="flex gap-1.5 overflow-x-auto">
          {book.stock.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.url} src={p.thumb ?? p.url} alt={p.credit ?? ""} title={p.credit} className="h-14 w-20 flex-none rounded object-cover" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-text disabled:opacity-30">
      {children}
    </button>
  );
}

function move(list: Source[], i: number, d: number): string[] {
  const ids = list.map((s) => s.id);
  const j = i + d;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ids;
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k) || null;
  } catch {
    return null;
  }
}

function safeSet(k: string, v: string) {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    // Sin almacenamiento: solo se pierde el «último libro abierto».
  }
}
