"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SlidePreview } from "@/components/SlidePreview";
import { Button, Check, Choice, downloadFrom, Notice, Panel, postJson, Section, SuggestDot, TextInput } from "@/components/ui";
import { useSettings } from "@/components/useSettings";
import { useWidth } from "@/components/useWidth";
import { buildProposals, composeSlides, type BrandAssets, type Design, type ImageOptions, suggestedImageOptions } from "@/design/compose";
import { LENGTH_LABEL, LIMITS, readText, type FormatId } from "@/design/fit";
import { FONTS, IMAGE_FONT_CHOICES, fontStack, type FontId } from "@/design/fonts";
import { PALETTES } from "@/design/palettes";
import type { ImageRequest } from "@/design/request";
import { BACKGROUNDS, FAMILIES, type BackgroundKind, type FamilyId, type PhotoRef } from "@/design/spec";
import { getTemplate } from "@/design/templates";
import { PhotoPicker } from "./PhotoPicker";

const SAMPLE = "No esperes el momento perfecto. Créalo.";

const FORMATS: { id: FormatId; label: string; hint: string }[] = [
  { id: "4:5", label: "4:5", hint: "Post vertical" },
  { id: "1:1", label: "1:1", hint: "Cuadrado" },
  { id: "9:16", label: "9:16", hint: "Historia" },
  { id: "carrusel", label: "Carrusel", hint: "Varias imágenes" },
];

interface Brief {
  tono: string;
  familias: FamilyId[];
  paleta: string;
  fuente: string;
  destacar: string[];
  fotoClave: string;
  razon: string;
}

interface Edit {
  design: Design;
  sizeScale: number;
  label: string;
}

export function ImageStudio() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<"una" | "lote">("una");
  const [text, setText] = useState(SAMPLE);
  const reading = useMemo(() => readText(text), [text]);
  const [opts, setOpts] = useState<ImageOptions>(() => suggestedImageOptions(readText(SAMPLE)));
  const [formatTouched, setFormatTouched] = useState(false);
  const [emphasisText, setEmphasisText] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefFor, setBriefFor] = useState("");
  const [briefBusy, setBriefBusy] = useState(false);
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [seed, setSeed] = useState(0);
  const [selected, setSelected] = useState(0);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [photo, setPhoto] = useState<PhotoRef | null>(null);
  const [caption, setCaption] = useState<{ texto: string; hashtags: string[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [batchText, setBatchText] = useState("");
  const [previewRef, previewWidth] = useWidth<HTMLDivElement>(420);
  const [thumbsRef, thumbsWidth] = useWidth<HTMLDivElement>(640);

  const hasAi = !!settings?.ai.resolved;
  const aiImages = !!settings?.ai.resolved?.images;
  const hasPhotos = !!settings && (settings.photos.unsplash || settings.photos.pexels);
  const brandHandle = settings?.brand.handle ?? "";
  const brandLogo = settings?.brand.logoUrl;

  const brand: BrandAssets | null = settings
    ? { handle: settings.brand.handle, logoUrl: settings.brand.logoUrl, colors: settings.brand.colors, font: settings.brand.font }
    : null;

  // Al cargar los ajustes, la firma viene marcada si hay usuario configurado.
  useEffect(() => {
    if (settings?.brand.handle) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpts((o) => ({ ...o, brand: { ...o.brand, handle: true } }));
    }
  }, [settings?.brand.handle]);

  // Reabrir un diseño de la galería: /imagenes?desde=<id>
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("desde");
    if (!id) return;
    fetch(`/api/gallery/${id}?meta`)
      .then((r) => (r.ok ? r.json() : null))
      .then((item: { request: ImageRequest } | null) => {
        if (!item) return;
        const r = item.request;
        setText(r.text);
        setOpts(r.options);
        setFormatTouched(true);
        setEmphasisText(r.emphasis.join(", "));
        setDesigns([r.design]);
        setSelected(0);
        setEdit({ design: r.design, sizeScale: r.sizeScale, label: r.label ?? "" });
        setPhoto(r.photo ?? null);
        if (r.caption) setCaption(r.caption);
      });
  }, []);

  const suggested = useMemo(() => suggestedImageOptions(reading, { handle: brandHandle }), [reading, brandHandle]);
  const effective: ImageOptions = formatTouched ? opts : { ...opts, format: suggested.format };
  const emphasis = emphasisText === null ? reading.emphasis : emphasisText.split(",").map((s) => s.trim()).filter(Boolean);
  const briefStale = !!brief && briefFor !== reading.text;

  const set = <K extends keyof ImageOptions>(k: K, v: ImageOptions[K]) => setOpts((o) => ({ ...o, [k]: v }));

  async function askBrief() {
    setBriefBusy(true);
    setMessage(null);
    try {
      const b = await postJson<Brief>("/api/ai", { task: "brief", text: reading.text });
      setBrief(b);
      setBriefFor(reading.text);
      setOpts((o) => ({ ...o, families: Array.from(new Set(b.familias)) as FamilyId[] }));
      if (b.destacar.length) setEmphasisText(b.destacar.join(", "));
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
      setOpts((o) => ({ ...o, ai: { suggest: false } }));
    } finally {
      setBriefBusy(false);
    }
  }

  function createProposals(nextSeed: number) {
    const list = buildProposals(effective, nextSeed);
    // La propuesta de la IA va primero y usa su paleta y fuente, si el usuario no fijó otras.
    if (opts.ai.suggest && brief && !briefStale && nextSeed === 0) {
      list[0] = {
        ...list[0],
        paletteId: effective.palette === "auto" ? brief.paleta : list[0].paletteId,
        font: effective.font === "auto" ? brief.fuente : list[0].font,
      };
    }
    setSeed(nextSeed);
    setDesigns(list);
    setSelected(0);
    setEdit({ design: list[0], sizeScale: 1, label: "" });
    setMessage(null);
  }

  function pick(i: number) {
    if (!designs) return;
    setSelected(i);
    setEdit({ design: designs[i], sizeScale: 1, label: edit?.label ?? "" });
  }

  const slidesFor = (design: Design, e?: Edit) =>
    composeSlides({
      text: reading.text || " ",
      options: effective,
      design,
      sizeScale: e?.sizeScale ?? 1,
      emphasis,
      label: e?.label || undefined,
      photo,
      brand,
    });

  const editSlides = edit ? slidesFor(edit.design, edit) : [];

  function request(): ImageRequest | null {
    if (!edit) return null;
    return {
      text: reading.text,
      options: effective,
      design: edit.design,
      sizeScale: edit.sizeScale,
      emphasis,
      label: edit.label || undefined,
      photo,
      caption: caption ?? undefined,
    };
  }

  async function download() {
    const req = request();
    if (!req) return;
    setBusy("download");
    setMessage(null);
    try {
      const res = await downloadFrom("/api/render/image", req, "appear.png");
      const saved = res.headers.get("X-Gallery-Id");
      setMessage({ tone: "ok", text: saved ? "Descargada y guardada en la galería." : "Descargada." });
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function writeCaption() {
    setBusy("caption");
    setMessage(null);
    try {
      setCaption(await postJson("/api/ai", { task: "caption", text: reading.text }));
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const batchTexts = batchText
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  async function runBatch() {
    setBusy("batch");
    setMessage(null);
    try {
      await downloadFrom("/api/render/batch", { texts: batchTexts, options: effective, autoFormat: !formatTouched }, "lote.zip");
      setMessage({ tone: "ok", text: `Listo: ${batchTexts.length} imágenes en un ZIP${effective.extras.gallery ? ", también guardadas en la galería" : ""}.` });
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const iaMark = (cond: boolean) => (opts.ai.suggest && brief && !briefStale && cond ? ("ia" as const) : undefined);

  return (
    <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-6 px-4 py-7 sm:px-8 lg:grid-cols-[340px_420px_minmax(0,1fr)]">
      {/* Paso 1 · Texto */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="eyebrow">Paso 1 · Tu texto</div>
          <div className="flex gap-1 rounded-lg bg-panel p-1 text-sm" role="tablist" aria-label="Modo">
            {(["una", "lote"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 ${mode === m ? "bg-panel-2 text-text" : "text-muted hover:text-text"}`}
              >
                {m === "una" ? "Una frase" : "Lote"}
              </button>
            ))}
          </div>
        </div>
        {mode === "una" ? (
          <>
            <label htmlFor="frase" className="font-display text-[28px] font-bold leading-[1.1] tracking-tight">
              ¿Qué quieres decir hoy?
            </label>
            <textarea
              id="frase"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="resize-y rounded-xl border border-line bg-panel p-4 text-lg leading-relaxed focus:border-accent"
              placeholder="Escribe o pega tu frase"
            />
            <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-panel p-4">
              <div className="eyebrow">Lectura del texto</div>
              <Row k="Caracteres" v={<span className="font-mono tabular-nums">{reading.chars}</span>} />
              <Row k="Palabras" v={<span className="font-mono tabular-nums">{reading.words}</span>} />
              <Row k="Longitud" v={LENGTH_LABEL[reading.lengthClass]} />
              <Row
                k="Formato sugerido"
                v={
                  <span className="text-suggest">
                    {suggested.format === "carrusel" ? `Carrusel · ${reading.slides.length} imágenes` : `${suggested.format} · 1 imagen`}
                  </span>
                }
              />
            </div>
            <p className="text-sm leading-relaxed text-muted">
              Hasta {LIMITS.corta} caracteres sugiere letra gigante en 4:5. Hasta {LIMITS.media}, 4:5 o 1:1 con letra media. Más de {LIMITS.media}, carrusel de hasta {LIMITS.porDiapositiva} caracteres por imagen.
            </p>
          </>
        ) : (
          <>
            <label htmlFor="lote" className="font-display text-[28px] font-bold leading-[1.1] tracking-tight">
              El contenido del mes, de una vez
            </label>
            <textarea
              id="lote"
              rows={14}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              className="resize-y rounded-xl border border-line bg-panel p-4 leading-relaxed focus:border-accent"
              placeholder={"Primera frase.\n\nSegunda frase.\n\nTercera frase."}
            />
            <p className="text-sm leading-relaxed text-muted">
              Separa cada frase con una línea en blanco. Se alternan los estilos marcados y{" "}
              {formatTouched ? "todas usan el formato elegido" : "cada frase usa el formato que sugiere su longitud"}.
            </p>
            <Button variant="primary" onClick={runBatch} busy={busy === "batch"} disabled={!batchTexts.length}>
              Generar {batchTexts.length || ""} imágenes (ZIP)
            </Button>
            {message && mode === "lote" ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          </>
        )}
      </section>

      {/* Paso 2 · Opciones */}
      <Panel
        eyebrow="Paso 2 · Opciones"
        title="Revisa y cambia lo que quieras"
        aside={
          <span className="whitespace-nowrap rounded-full border border-suggest-line px-2.5 py-1 text-xs text-suggest">
            ● sugerido
          </span>
        }
        className="lg:max-h-[calc(100vh-120px)]"
      >
        <Section title="Formato">
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <Choice
                key={f.id}
                name="formato"
                value={f.id}
                checked={effective.format === f.id}
                suggested={suggested.format === f.id}
                onSelect={(v) => {
                  setFormatTouched(true);
                  set("format", v as FormatId);
                }}
              >
                <span className="font-semibold">{f.label}</span> <span className="text-xs text-muted">{f.hint}</span>
              </Choice>
            ))}
          </div>
          {effective.format === "carrusel" ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted">Cada imagen:</span>
              {(["4:5", "1:1"] as const).map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input type="radio" name="carrusel-aspecto" checked={effective.carouselAspect === a} onChange={() => set("carouselAspect", a)} />
                  {a} {a === "4:5" ? <SuggestDot /> : null}
                </label>
              ))}
            </div>
          ) : null}
          {effective.format !== "carrusel" && (reading.lengthClass === "larga" || reading.lengthClass === "muy-larga") ? (
            <Notice>El texto es largo y la letra saldrá pequeña. El carrusel lo reparte en {reading.slides.length} imágenes.</Notice>
          ) : null}
          <Check id="hires" checked={effective.hiRes} onChange={(v) => set("hiRes", v)} suggested>
            Exportar en doble resolución <span className="text-muted">(2160 px de ancho)</span>
          </Check>
        </Section>

        <Section title="Estilos a proponer">
          <div className="grid grid-cols-2 gap-2.5">
            {FAMILIES.map((f) => {
              const on = opts.families.includes(f.id);
              return (
                <Check
                  key={f.id}
                  id={`fam-${f.id}`}
                  checked={on}
                  disabled={on && opts.families.length === 1}
                  suggested={iaMark(!!brief?.familias.includes(f.id)) ?? true}
                  hint={f.hint}
                  onChange={(v) => set("families", v ? [...opts.families, f.id] : opts.families.filter((x) => x !== f.id))}
                >
                  {f.label}
                </Check>
              );
            })}
          </div>
        </Section>

        <Section title="Tipografía">
          <div className="flex flex-wrap gap-2">
            <FontChip active={opts.font === "auto"} onClick={() => set("font", "auto")} suggested>
              Que decida cada estilo
            </FontChip>
            {IMAGE_FONT_CHOICES.map((id) => (
              <FontChip key={id} active={opts.font === id} onClick={() => set("font", id)} font={id} suggested={iaMark(brief?.fuente === id)}>
                {FONTS[id].label}
              </FontChip>
            ))}
          </div>
        </Section>

        <Section title="Paleta">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => set("palette", "auto")}
              aria-pressed={opts.palette === "auto"}
              className={`col-span-3 flex items-center justify-between rounded-[10px] border px-3 py-2 text-left text-sm ${opts.palette === "auto" ? "border-accent bg-accent-soft" : "border-line"}`}
            >
              Que decida cada estilo <SuggestDot />
            </button>
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => set("palette", p.id)}
                aria-pressed={opts.palette === p.id}
                className={`flex flex-col gap-1.5 rounded-[10px] border p-2 text-left ${opts.palette === p.id ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}
              >
                <span className="flex h-5 overflow-hidden rounded">
                  {[p.bg, p.fg, p.accent, p.accent2].map((c, i) => (
                    <span key={i} className="flex-1" style={{ background: c }} />
                  ))}
                </span>
                <span className="flex items-center justify-between text-xs">
                  {p.label} {iaMark(brief?.paleta === p.id) ? <SuggestDot kind="ia" /> : null}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Fondo" note="(las propuestas alternan los marcados)">
          <div className="grid grid-cols-2 gap-2.5">
            {BACKGROUNDS.map((b) => {
              const on = opts.backgrounds.includes(b.id);
              const unavailable = (b.id === "foto" && !hasPhotos) || (b.id === "ia" && !aiImages);
              return (
                <Check
                  key={b.id}
                  id={`bg-${b.id}`}
                  checked={on}
                  disabled={(on && opts.backgrounds.length === 1) || (!on && unavailable)}
                  suggested={suggested.backgrounds.includes(b.id)}
                  hint={
                    b.id === "foto" && !hasPhotos
                      ? "Necesita una key de Unsplash o Pexels"
                      : b.id === "ia" && !aiImages
                        ? "Necesita una key de OpenAI"
                        : undefined
                  }
                  onChange={(v) => set("backgrounds", v ? [...opts.backgrounds, b.id] : opts.backgrounds.filter((x) => x !== b.id))}
                >
                  {b.label}
                </Check>
              );
            })}
          </div>
        </Section>

        <Section title="Marca personal">
          <div className="grid grid-cols-2 gap-2.5">
            <Check id="m-handle" checked={opts.brand.handle} disabled={!brandHandle} onChange={(v) => set("brand", { ...opts.brand, handle: v })} suggested={!!brandHandle} hint={brandHandle || "Sin configurar"}>
              Firma
            </Check>
            <Check id="m-logo" checked={opts.brand.logo} disabled={!brandLogo} onChange={(v) => set("brand", { ...opts.brand, logo: v })} hint={brandLogo ? "Subido" : "Sin configurar"}>
              Logo
            </Check>
            <Check id="m-pal" checked={opts.brand.palette} onChange={(v) => set("brand", { ...opts.brand, palette: v })}>
              Paleta de marca
            </Check>
            <Check id="m-font" checked={opts.brand.font} onChange={(v) => set("brand", { ...opts.brand, font: v })}>
              Fuente de marca
            </Check>
          </div>
          <Link href="/ajustes#marca" className="text-sm text-accent hover:underline">
            Configurar la marca
          </Link>
        </Section>

        <Section title="Extras">
          <div className="grid grid-cols-2 gap-2.5">
            <Check id="x-gal" checked={opts.extras.gallery} onChange={(v) => set("extras", { ...opts.extras, gallery: v })} suggested>
              Guardar en galería
            </Check>
            <Check id="x-cap" checked={opts.extras.caption} disabled={!hasAi} onChange={(v) => set("extras", { ...opts.extras, caption: v })} hint={!hasAi ? "Necesita IA" : undefined}>
              Texto de publicación
            </Check>
            <Check id="x-tag" checked={opts.extras.hashtags} disabled={!hasAi} onChange={(v) => set("extras", { ...opts.extras, hashtags: v })} hint={!hasAi ? "Necesita IA" : undefined}>
              Hashtags
            </Check>
          </div>
        </Section>

        <Section title="Ayuda de la IA" note="(apagada por defecto)">
          <Check
            id="ia-sug"
            checked={opts.ai.suggest}
            disabled={!hasAi || briefBusy}
            onChange={(v) => {
              set("ai", { suggest: v });
              if (v) void askBrief();
            }}
            hint={hasAi ? "La propuesta llega marcada con «IA» en este panel y puedes cambiarla." : "Añade una API key en Ajustes para usarla."}
          >
            Sugerir estilo según el tono del texto
          </Check>
          {briefBusy ? <Notice>Leyendo el tono del texto…</Notice> : null}
          {opts.ai.suggest && brief ? (
            <div className="rounded-xl border border-line bg-panel-2 p-3 text-sm leading-relaxed">
              <div>
                <span className="text-muted">Tono:</span> {brief.tono}
              </div>
              <div className="text-muted">{brief.razon}</div>
              {briefStale ? (
                <Button className="mt-2 h-9" onClick={askBrief} busy={briefBusy}>
                  El texto cambió: pedir otra sugerencia
                </Button>
              ) : null}
            </div>
          ) : null}
        </Section>
      </Panel>

      {/* Paso 3 · Propuestas y ajuste */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="eyebrow">Paso 3 · Propuestas</div>
            <h2 className="mt-1 font-display text-lg font-bold">{designs ? "Elige una y ajústala" : "Crea cuatro propuestas"}</h2>
          </div>
          {designs ? <span className="text-sm text-muted">{designs.length} propuestas</span> : null}
        </div>

        {mode === "lote" ? (
          <LotePreview texts={batchTexts} opts={effective} brand={brand} formatTouched={formatTouched} />
        ) : !designs ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line-strong p-10 text-center">
            <p className="max-w-sm text-muted">Con las opciones del panel se crean cuatro diseños distintos. Después eliges uno y ajustas paleta, letra, tamaño y fondo.</p>
            <Button variant="primary" onClick={() => createProposals(0)} disabled={!reading.text}>
              Crear 4 propuestas
            </Button>
          </div>
        ) : (
          <>
            <div ref={thumbsRef} className="grid grid-cols-4 gap-3">
              {designs.map((d, i) => {
                const s = slidesFor(d)[0];
                return (
                  <button
                    key={`${seed}-${i}`}
                    type="button"
                    onClick={() => pick(i)}
                    aria-pressed={selected === i}
                    aria-label={`Propuesta ${i + 1}: ${getTemplate(d.templateId).label}`}
                    className={`rounded-[10px] p-0.5 text-left transition-shadow ${selected === i ? "ring-2 ring-accent ring-offset-2 ring-offset-ink" : "opacity-85 hover:opacity-100"}`}
                  >
                    <SlidePreview spec={s} width={Math.max(60, Math.floor((thumbsWidth - 36) / 4) - 4)} className="rounded-lg" />
                    <span className="mt-1.5 block truncate text-xs text-muted">{getTemplate(d.templateId).label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => createProposals(seed + 1)}>Crear otras 4</Button>
            </div>

            {edit ? (
              <div className="grid gap-5 rounded-2xl border border-line bg-panel p-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div ref={previewRef} className="flex min-w-0 flex-col gap-3">
                  <div className="scroll-thin flex gap-3 overflow-x-auto pb-1">
                    {editSlides.map((s) => (
                      <SlidePreview
                        key={s.index}
                        spec={s}
                        width={editSlides.length > 1 ? Math.min(300, previewWidth - 40) : Math.min(previewWidth, s.height > s.width * 1.5 ? 340 : 480)}
                        className="flex-none rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted">
                    {editSlides.length > 1 ? `${editSlides.length} imágenes` : "1 imagen"} de {editSlides[0]?.width * (effective.hiRes ? 2 : 1)} ×{" "}
                    {editSlides[0]?.height * (effective.hiRes ? 2 : 1)} px
                    {photo?.credit ? ` · Foto: ${photo.credit}` : ""}
                  </p>
                </div>
                <FineTune
                  edit={edit}
                  setEdit={setEdit}
                  emphasisText={emphasisText ?? reading.emphasis.join(", ")}
                  setEmphasisText={setEmphasisText}
                  photo={photo}
                  setPhoto={setPhoto}
                  text={reading.text}
                  hasPhotos={!!hasPhotos}
                  aiImages={aiImages}
                  photoQuery={brief?.fotoClave ?? ""}
                />
              </div>
            ) : null}

            {opts.extras.caption || opts.extras.hashtags ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Texto para la publicación</h3>
                  <Button className="h-9" onClick={writeCaption} busy={busy === "caption"}>
                    {caption ? "Escribir otro" : "Escribirlo con IA"}
                  </Button>
                </div>
                {caption ? <CaptionBox caption={caption} showText={opts.extras.caption} showTags={opts.extras.hashtags} /> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" className="min-w-56" onClick={download} busy={busy === "download"}>
                {editSlides.length > 1 ? `Descargar carrusel (${editSlides.length} PNG)` : "Descargar PNG"}
              </Button>
              {message && mode === "una" ? <Notice tone={message.tone}>{message.text}</Notice> : null}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function FontChip({
  active,
  onClick,
  font,
  suggested,
  children,
}: {
  active: boolean;
  onClick: () => void;
  font?: FontId;
  suggested?: boolean | "ia";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={font ? { fontFamily: fontStack(font) } : undefined}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 ${font ? "text-[17px]" : "text-sm"} ${active ? "border-accent bg-accent-soft" : "border-line hover:border-line-strong"}`}
    >
      {children}
      {suggested ? <SuggestDot kind={suggested === "ia" ? "ia" : "sistema"} /> : null}
    </button>
  );
}

function FineTune({
  edit,
  setEdit,
  emphasisText,
  setEmphasisText,
  photo,
  setPhoto,
  text,
  hasPhotos,
  aiImages,
  photoQuery,
}: {
  edit: Edit;
  setEdit: (e: Edit) => void;
  emphasisText: string;
  setEmphasisText: (v: string) => void;
  photo: PhotoRef | null;
  setPhoto: (p: PhotoRef | null) => void;
  text: string;
  hasPhotos: boolean;
  aiImages: boolean;
  photoQuery: string;
}) {
  const d = edit.design;
  const setD = (patch: Partial<Design>) => setEdit({ ...edit, design: { ...d, ...patch } });
  return (
    <div className="flex flex-col gap-4 text-sm">
      <h3 className="font-semibold">Ajuste fino</h3>
      <div className="flex flex-col gap-1.5">
        <span className="text-muted">Paleta</span>
        <div className="flex flex-wrap gap-1.5">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.label}
              aria-label={p.label}
              aria-pressed={d.paletteId === p.id}
              onClick={() => setD({ paletteId: p.id })}
              className={`h-8 w-8 overflow-hidden rounded-full border-2 ${d.paletteId === p.id ? "border-accent" : "border-transparent"}`}
              style={{ background: `linear-gradient(135deg, ${p.bg} 50%, ${p.accent} 50%)` }}
            />
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted">Tipografía</span>
        <select
          value={d.font ?? ""}
          onChange={(e) => setD({ font: e.target.value || null })}
          className="h-10 rounded-lg border border-line bg-ink px-2"
        >
          <option value="">La del estilo ({FONTS[getTemplate(d.templateId).defaultFont].label})</option>
          {IMAGE_FONT_CHOICES.map((id) => (
            <option key={id} value={id}>
              {FONTS[id].label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-muted">
          Tamaño de letra <span className="font-mono">{Math.round(edit.sizeScale * 100)}%</span>
        </span>
        <input type="range" min={0.6} max={1.3} step={0.05} value={edit.sizeScale} onChange={(e) => setEdit({ ...edit, sizeScale: parseFloat(e.target.value) })} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted">Fondo</span>
        <select value={d.background} onChange={(e) => setD({ background: e.target.value as BackgroundKind })} className="h-10 rounded-lg border border-line bg-ink px-2">
          {BACKGROUNDS.map((b) => (
            <option key={b.id} value={b.id} disabled={(b.id === "foto" && !hasPhotos) || (b.id === "ia" && !aiImages)}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {d.background === "foto" || d.background === "ia" ? (
        <PhotoPicker mode={d.background} text={text} photo={photo} setPhoto={setPhoto} defaultQuery={photoQuery} />
      ) : null}
      <label className="flex flex-col gap-1.5">
        <span className="text-muted">Destacar (separa con comas)</span>
        <TextInput value={emphasisText} onChange={(e) => setEmphasisText(e.target.value)} placeholder="Créalo." />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-muted">Etiqueta corta (opcional)</span>
        <TextInput value={edit.label} maxLength={40} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="Lunes · Regla nº 3" />
      </label>
    </div>
  );
}

function CaptionBox({ caption, showText, showTags }: { caption: { texto: string; hashtags: string[] }; showText: boolean; showTags: boolean }) {
  const full = [showText ? caption.texto : "", showTags ? caption.hashtags.join(" ") : ""].filter(Boolean).join("\n\n");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <textarea readOnly value={full} rows={5} className="rounded-xl border border-line bg-ink p-3 text-sm leading-relaxed" />
      <Button
        className="h-9 self-start"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(full);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function LotePreview({ texts, opts, brand, formatTouched }: { texts: string[]; opts: ImageOptions; brand: BrandAssets | null; formatTouched: boolean }) {
  if (!texts.length) {
    return <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-line-strong p-10 text-center text-muted">Aquí verás las primeras imágenes del lote.</div>;
  }
  const designs = buildProposals(opts, 0, Math.max(4, texts.length));
  const shown = texts.slice(0, 8);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((t, i) => {
          const r = readText(t);
          const o = formatTouched ? opts : { ...opts, format: r.suggestedFormat };
          const s = composeSlides({ text: t, options: o, design: designs[i], brand })[0];
          return <SlidePreview key={i} spec={s} width={150} className="rounded-lg" />;
        })}
      </div>
      {texts.length > shown.length ? <p className="text-sm text-muted">Y {texts.length - shown.length} más.</p> : null}
    </div>
  );
}
