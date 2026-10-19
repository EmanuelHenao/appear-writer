"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SlidePreview } from "@/components/SlidePreview";
import { Dice, Download, Star, Undo } from "@/components/icons";
import { StepHead, StudioLayout, type Step } from "@/components/StudioLayout";
import { Button, Check, Choice, downloadFrom, Notice, postJson, Section, SuggestDot, TextInput } from "@/components/ui";
import { useSettings } from "@/components/useSettings";
import { useMedia, useSize } from "@/components/useWidth";
import {
  buildProposals,
  composeSlides,
  ImageOptionsSchema,
  randomDesign,
  suggestedImageOptions,
  type BrandAssets,
  type Design,
  type ImageOptions,
} from "@/design/compose";
import { LENGTH_LABEL, LIMITS, readText, type FormatId } from "@/design/fit";
import { FONTS, IMAGE_FONT_CHOICES, fontStack, type FontId } from "@/design/fonts";
import { CAPTION_STYLES, templateCaption, type Caption, type CaptionStyle } from "@/design/caption";
import { getPalette, PALETTES } from "@/design/palettes";
import { INTENSITIES, makePattern, PATTERNS, patternLabel, randomSeed, type Intensity, type PatternDesign, type PatternId } from "@/design/patterns";
import type { ImageRequest } from "@/design/request";
import { BACKGROUNDS, FAMILIES, type BackgroundKind, type FamilyId, type PhotoRef } from "@/design/spec";
import { getTemplate } from "@/design/templates";
import { PatternPanel } from "./PatternPanel";
import { PhotoPicker } from "./PhotoPicker";
import { sameDesign, SavedTemplatesSection, useSavedTemplates } from "./SavedTemplates";

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
  const [patternsTouched, setPatternsTouched] = useState(false);
  const [emphasisText, setEmphasisText] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [briefFor, setBriefFor] = useState("");
  const [briefBusy, setBriefBusy] = useState(false);
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [seed, setSeed] = useState(0);
  const [selected, setSelected] = useState(0);
  const [edit, setEditState] = useState<Edit | null>(null);
  /** Diseños anteriores del botón «Aleatorio», para volver atrás. */
  const [history, setHistory] = useState<Design[]>([]);
  const saved = useSavedTemplates();
  const [usedSaved, setUsedSaved] = useState<string[]>([]);
  const [photo, setPhoto] = useState<PhotoRef | null>(null);
  /** Texto de publicación escrito o editado (por ti o por la IA); null = el de la plantilla. */
  const [caption, setCaption] = useState<Caption | null>(null);
  const [captionFromAi, setCaptionFromAi] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>("reflexion");
  const [captionVariant, setCaptionVariant] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const [batchText, setBatchText] = useState("");
  const [stageRef, stage] = useSize<HTMLDivElement>();
  const wide = useMedia("(min-width: 1024px)");

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
        // Los diseños guardados con versiones anteriores reciben los campos nuevos.
        const parsed = ImageOptionsSchema.safeParse(r.options);
        setOpts(parsed.success ? parsed.data : r.options);
        setFormatTouched(true);
        setPatternsTouched(true);
        setEmphasisText(r.emphasis.join(", "));
        setDesigns([r.design]);
        setSelected(0);
        setEditState({ design: r.design, sizeScale: r.sizeScale, label: r.label ?? "" });
        setPhoto(r.photo ?? null);
        if (r.caption) setCaption(r.caption);
      });
  }, []);

  const suggested = useMemo(() => suggestedImageOptions(reading, { handle: brandHandle }), [reading, brandHandle]);
  const effective: ImageOptions = {
    ...opts,
    format: formatTouched ? opts.format : suggested.format,
    patterns: patternsTouched ? opts.patterns : suggested.patterns,
  };
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

  // Al ajustar la propuesta elegida, su miniatura cambia también.
  function setEdit(e: Edit) {
    setEditState(e);
    setDesigns((list) => (list ? list.map((d, i) => (i === selected ? e.design : d)) : list));
  }

  const savedDesigns = saved.list.filter((t) => usedSaved.includes(t.id)).map((t) => t.design);
  const photoReady = (b: BackgroundKind) => (b !== "foto" && b !== "ia") || !!photo?.url;

  function createProposals(nextSeed: number) {
    const list = buildProposals(effective, nextSeed, 4, savedDesigns);
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
    setHistory([]);
    setEditState({ design: list[0], sizeScale: savedScale(list[0]), label: "" });
    setMessage(null);
  }

  const savedScale = (d: Design) => saved.list.find((t) => usedSaved.includes(t.id) && sameDesign(t.design, d))?.sizeScale ?? 1;

  /** Cuatro diseños al azar con lo marcado en el panel. */
  function randomProposals() {
    const list = Array.from({ length: 4 }, () => randomDesign(effective, randomSeed(), photoReady));
    setSeed((s) => s + 1);
    setDesigns(list);
    setSelected(0);
    setHistory([]);
    setEditState({ design: list[0], sizeScale: 1, label: edit?.label ?? "" });
    setMessage(null);
  }

  /** Cambia la propuesta elegida por otra al azar; la anterior queda en el historial. */
  function randomizeSelected() {
    if (!edit) return;
    const d = randomDesign(effective, randomSeed(), photoReady);
    setHistory((h) => [...h.slice(-19), edit.design]);
    setEdit({ ...edit, design: d, sizeScale: 1 });
  }

  function undoRandom() {
    if (!edit || !history.length) return;
    setEdit({ ...edit, design: history[history.length - 1] });
    setHistory((h) => h.slice(0, -1));
  }

  function pick(i: number) {
    if (!designs) return;
    setSelected(i);
    setHistory([]);
    setEditState({ design: designs[i], sizeScale: savedScale(designs[i]), label: edit?.label ?? "" });
  }

  const savedMatch = (d: Design) => saved.list.find((t) => sameDesign(t.design, d));

  async function toggleSaved(i: number) {
    if (!designs) return;
    const d = designs[i];
    const found = savedMatch(d);
    try {
      if (found) {
        await saved.remove(found.id);
        setUsedSaved((u) => u.filter((x) => x !== found.id));
        setMessage({ tone: "info", text: `Quitada de tus plantillas: ${found.name}.` });
      } else {
        const t = getTemplate(d.templateId);
        const pat = d.background === "patron" && d.pattern ? ` · ${d.pattern.layers.map(patternLabel).join(" + ")}` : "";
        const item = await saved.save(`${t.label} · ${getPalette(d.paletteId).label}${pat}`.slice(0, 60), d, i === selected && edit ? edit.sizeScale : 1);
        setMessage({ tone: "ok", text: `Guardada en «Mis plantillas»: ${item.name}.` });
      }
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    }
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
  const captionShown = caption ?? templateCaption(reading.text, { style: captionStyle, variant: captionVariant, handle: opts.brand.handle ? brandHandle : "" });

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
      caption: opts.extras.caption || opts.extras.hashtags ? { texto: opts.extras.caption ? captionShown.texto : "", hashtags: opts.extras.hashtags ? captionShown.hashtags : [] } : undefined,
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
      setCaption(await postJson<Caption>("/api/ai", { task: "caption", text: reading.text }));
      setCaptionFromAi(true);
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
      await downloadFrom(
        "/api/render/batch",
        { texts: batchTexts, options: effective, autoFormat: !formatTouched, caption: { style: captionStyle, handle: opts.brand.handle ? brandHandle : "" } },
        "lote.zip",
      );
      setMessage({ tone: "ok", text: `Listo: ${batchTexts.length} imágenes en un ZIP${effective.extras.gallery ? ", también guardadas en la galería" : ""}.` });
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const iaMark = (cond: boolean) => (opts.ai.suggest && brief && !briefStale && cond ? ("ia" as const) : undefined);

  function resetOptions() {
    setOpts(suggestedImageOptions(reading, { handle: brandHandle }));
    setFormatTouched(false);
    setPatternsTouched(false);
    setEmphasisText(null);
  }

  // ← y → cambian de propuesta (si no se está escribiendo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!designs || mode !== "una" || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      pick((selected + (e.key === "ArrowRight" ? 1 : designs.length - 1)) % designs.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Encaje de la vista previa y de las miniaturas en el hueco de la derecha.
  const aspect = editSlides[0] ? editSlides[0].width / editSlides[0].height : 0.8;
  const multi = editSlides.length > 1;
  let thumbW: number;
  let previewW: number;
  if (wide) {
    thumbW = clamp(Math.floor(((stage.height - 4 * 26 - 3 * 10) / 4) * aspect), 44, 104);
    const availW = stage.width - thumbW - 32;
    const availH = stage.height - 30;
    previewW = Math.floor(Math.min(multi ? availW * 0.82 : availW, availH * aspect));
  } else {
    thumbW = clamp(Math.floor((stage.width - 30) / 4) - 6, 44, 104);
    previewW = Math.floor(Math.min(stage.width * (multi ? 0.85 : 1), 520));
  }
  previewW = Math.max(previewW, 160);

  const fmt = FORMATS.find((f) => f.id === effective.format) ?? FORMATS[0];
  const familySummary = opts.families.length === FAMILIES.length ? "Los 4" : FAMILIES.filter((f) => opts.families.includes(f.id)).map((f) => f.label).join(" · ");
  const brandSummary = [opts.brand.handle && "Firma", opts.brand.logo && "Logo", opts.brand.palette && "Paleta", opts.brand.font && "Fuente"].filter(Boolean).join(" · ") || "Ninguna";
  const extrasSummary = [opts.extras.gallery && "Galería", opts.extras.caption && "Texto", opts.extras.hashtags && "Hashtags"].filter(Boolean).join(" · ") || "Ninguno";
  const selectedSaved = designs && edit ? !!savedMatch(designs[selected]) : false;

  const steps: Step[] =
    mode === "lote"
      ? [
          { id: "paso-1", label: "Textos", done: batchTexts.length > 0, current: !batchTexts.length },
          { id: "paso-2", label: "Opciones", current: batchTexts.length > 0 },
        ]
      : [
          { id: "paso-1", label: "Texto", done: !!reading.text, current: !reading.text },
          { id: "paso-2", label: "Opciones", done: !!designs, current: !!reading.text && !edit },
          ...(edit ? [{ id: "paso-3", label: "Ajuste fino", current: true }] : []),
        ];

  const footer =
    mode === "lote" ? (
      <Button variant="primary" className="w-full" onClick={runBatch} busy={busy === "batch"} disabled={!batchTexts.length}>
        Generar {batchTexts.length || ""} imágenes (ZIP)
      </Button>
    ) : (
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" onClick={() => createProposals(designs ? seed + 1 : 0)} disabled={!reading.text}>
          {designs ? "Crear otras 4 propuestas" : "Crear 4 propuestas"}
        </Button>
        <Button onClick={randomProposals} disabled={!reading.text} title="Cuatro diseños al azar con lo marcado en el panel">
          <Dice />4 al azar
        </Button>
      </div>
    );

  const aside = (
    <>
      {/* Paso 1 · Texto */}
      <section id="paso-1" className="flex scroll-mt-4 flex-col gap-3">
        <StepHead label={mode === "una" ? "Paso 1 · Tu texto" : "Paso 1 · Tus textos"}>
          <div className="flex gap-0.5 rounded-lg bg-ink p-[3px] text-[13px]" role="tablist" aria-label="Modo">
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
        </StepHead>
        {mode === "una" ? (
          <>
            <label htmlFor="frase" className="font-display text-2xl font-bold leading-[1.1] tracking-tight">
              ¿Qué quieres decir hoy?
            </label>
            <textarea
              id="frase"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="resize-y rounded-xl border border-line bg-ink p-3.5 text-base leading-relaxed focus:border-accent"
              placeholder="Escribe o pega tu frase"
            />
            <div className="flex flex-wrap gap-1.5" aria-label="Lectura del texto">
              <Chip>
                <span className="font-mono tabular-nums">{reading.chars}</span> caracteres
              </Chip>
              <Chip>
                <span className="font-mono tabular-nums">{reading.words}</span> palabras
              </Chip>
              <Chip>{LENGTH_LABEL[reading.lengthClass]}</Chip>
              <Chip
                suggest
                title={`Hasta ${LIMITS.corta} caracteres sugiere letra gigante en 4:5. Hasta ${LIMITS.media}, 4:5 o 1:1 con letra media. Más de ${LIMITS.media}, carrusel de hasta ${LIMITS.porDiapositiva} caracteres por imagen.`}
              >
                ● {suggested.format === "carrusel" ? `Carrusel · ${reading.slides.length} imágenes` : `${suggested.format} · 1 imagen`}
              </Chip>
            </div>
          </>
        ) : (
          <>
            <label htmlFor="lote" className="font-display text-2xl font-bold leading-[1.1] tracking-tight">
              El contenido del mes, de una vez
            </label>
            <textarea
              id="lote"
              rows={10}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              className="resize-y rounded-xl border border-line bg-ink p-3.5 leading-relaxed focus:border-accent"
              placeholder={"Primera frase.\n\nSegunda frase.\n\nTercera frase."}
            />
            <p className="text-sm leading-relaxed text-muted">
              Separa cada frase con una línea en blanco. Se alternan los estilos marcados y{" "}
              {formatTouched ? "todas usan el formato elegido" : "cada frase usa el formato que sugiere su longitud"}.
            </p>
          </>
        )}
      </section>

      {/* Paso 2 · Opciones */}
      <section id="paso-2" className="flex scroll-mt-4 flex-col">
        <StepHead label="Paso 2 · Opciones">
          <span className="flex items-center gap-3">
            <button type="button" onClick={resetOptions} className="text-xs text-accent hover:underline">
              Volver a lo sugerido
            </button>
            <span className="whitespace-nowrap rounded-full border border-suggest-line px-2 py-0.5 text-[11px] text-suggest">● sugerido</span>
          </span>
        </StepHead>
        <div className="mt-2">
          <Section title="Formato" defaultOpen summary={`${fmt.label} ${fmt.hint}`} suggested={effective.format === suggested.format}>
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

          <Section title="Estilos" summary={familySummary} suggested={sameSet(opts.families, suggested.families)}>
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

          <Section
            title="Tipografía"
            summary={opts.font === "auto" ? "Que decida cada estilo" : (FONTS[opts.font as FontId]?.label ?? opts.font)}
            suggested={opts.font === "auto" || iaMark(brief?.fuente === opts.font)}
          >
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

          <Section
            title="Paleta"
            summary={opts.palette === "auto" ? "Que decida cada estilo" : getPalette(opts.palette).label}
            suggested={opts.palette === "auto" || iaMark(brief?.paleta === opts.palette)}
          >
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

          <Section
            title="Fondo"
            summary={BACKGROUNDS.filter((b) => opts.backgrounds.includes(b.id)).map((b) => b.label.replace(" generativo", "")).join(" · ")}
            suggested={sameSet(opts.backgrounds, suggested.backgrounds)}
          >
            <p className="text-xs text-muted">Las propuestas alternan los fondos marcados.</p>
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

          <PatternPanel
            value={effective.patterns}
            suggested={suggested.patterns}
            active={opts.backgrounds.includes("patron")}
            onChange={(v) => {
              setPatternsTouched(true);
              set("patterns", v);
            }}
          />

          <SavedTemplatesSection
            list={saved.list}
            used={usedSaved}
            setUsed={setUsedSaved}
            preview={(t) =>
              composeSlides({ text: reading.text || " ", options: effective, design: t.design, sizeScale: t.sizeScale, emphasis, photo, brand })[0]
            }
            onRemove={(id) => {
              void saved.remove(id);
              setUsedSaved((u) => u.filter((x) => x !== id));
            }}
            onRename={(id, name) => void saved.rename(id, name)}
            onUse={() => {
              if (mode === "lote") setMode("una");
              createProposals(0);
            }}
          />

          <Section title="Marca personal" summary={brandSummary} suggested={JSON.stringify(opts.brand) === JSON.stringify(suggested.brand)}>
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

          <Section title="Extras" summary={extrasSummary} suggested={JSON.stringify(opts.extras) === JSON.stringify(suggested.extras)}>
            <div className="grid grid-cols-2 gap-2.5">
              <Check id="x-gal" checked={opts.extras.gallery} onChange={(v) => set("extras", { ...opts.extras, gallery: v })} suggested>
                Guardar en galería
              </Check>
              <Check id="x-cap" checked={opts.extras.caption} onChange={(v) => set("extras", { ...opts.extras, caption: v })} hint="Con plantillas, sin IA">
                Texto de publicación
              </Check>
              <Check id="x-tag" checked={opts.extras.hashtags} onChange={(v) => set("extras", { ...opts.extras, hashtags: v })} hint="De las palabras del texto">
                Hashtags
              </Check>
            </div>
          </Section>

          <Section title="Ayuda de la IA" summary={opts.ai.suggest ? "Encendida" : "Apagada"}>
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
        </div>
      </section>

      {/* Paso 3 · Ajuste fino */}
      {mode === "una" && edit ? (
        <section id="paso-3" className="flex scroll-mt-4 flex-col gap-4 rounded-2xl border border-line-strong bg-panel-2 p-4">
          <StepHead label="Paso 3 · Ajuste fino" accent>
            <span className="text-xs text-muted">
              Propuesta {selected + 1} · {getTemplate(edit.design.templateId).label}
            </span>
          </StepHead>
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
            patternDefaults={effective.patterns}
          />
          {opts.extras.caption || opts.extras.hashtags ? (
            <CaptionPanel
              caption={captionShown}
              edited={!!caption}
              fromAi={captionFromAi}
              showText={opts.extras.caption}
              showTags={opts.extras.hashtags}
              style={captionStyle}
              hasAi={hasAi}
              aiBusy={busy === "caption"}
              onStyle={(st) => {
                setCaptionStyle(st);
                setCaption(null);
                setCaptionFromAi(false);
              }}
              onVariant={() => {
                setCaptionVariant((v) => v + 1);
                setCaption(null);
                setCaptionFromAi(false);
              }}
              onEdit={(c) => setCaption(c)}
              onReset={() => {
                setCaption(null);
                setCaptionFromAi(false);
              }}
              onAi={writeCaption}
            />
          ) : null}
        </section>
      ) : null}
    </>
  );

  return (
    <StudioLayout steps={steps} aside={aside} footer={footer}>
      {mode === "lote" ? (
        <>
          <div>
            <div className="eyebrow">Lote · {batchTexts.length} {batchTexts.length === 1 ? "frase" : "frases"}</div>
            <h1 className="mt-1 font-display text-xl font-bold">Así saldrán las primeras</h1>
          </div>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
            <LotePreview texts={batchTexts} opts={effective} brand={brand} formatTouched={formatTouched} />
          </div>
        </>
      ) : !designs || !edit ? (
        <>
          <div>
            <div className="eyebrow">Propuestas</div>
            <h1 className="mt-1 font-display text-xl font-bold">Crea cuatro propuestas</h1>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line-strong p-10 text-center">
            <p className="max-w-sm text-muted">Con las opciones del panel se crean cuatro diseños distintos. Después eliges uno y lo ajustas en el paso 3.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => createProposals(0)} disabled={!reading.text}>
                Crear 4 propuestas
              </Button>
              <Button onClick={randomProposals} disabled={!reading.text}>
                <Dice />4 al azar
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="eyebrow">
                Propuesta {selected + 1} de {designs.length} · {getTemplate(edit.design.templateId).label}
              </div>
              <h1 className="mt-1 font-display text-xl font-bold">Elige una y ajústala</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="h-10" onClick={randomizeSelected} title="Cambia la propuesta elegida por una al azar con lo marcado en el panel">
                <Dice />
                Aleatorio
              </Button>
              {history.length ? (
                <Button className="h-10" onClick={undoRandom} title="Volver al diseño anterior">
                  <Undo />
                  Anterior
                </Button>
              ) : null}
              <Button className={`h-10 ${selectedSaved ? "text-suggest" : ""}`} aria-pressed={selectedSaved} onClick={() => void toggleSaved(selected)} title={selectedSaved ? "Quitar de mis plantillas" : "Guardar en mis plantillas"}>
                <Star filled={selectedSaved} />
                {selectedSaved ? "Guardada" : "Guardar plantilla"}
              </Button>
              <Button variant="primary" className="h-10" onClick={download} busy={busy === "download"}>
                {busy === "download" ? null : <Download />}
                {multi ? `Descargar ${editSlides.length} PNG` : "Descargar PNG"}
              </Button>
            </div>
          </div>
          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

          <div ref={stageRef} className="flex min-h-0 flex-1 flex-col items-center gap-5 lg:flex-row lg:justify-center lg:gap-8 lg:overflow-hidden">
            <div className="flex min-w-0 max-w-full flex-col items-center gap-2.5">
              <div className="scroll-thin flex max-w-full gap-4 overflow-x-auto pb-1">
                {editSlides.map((s) => (
                  <SlidePreview key={s.index} spec={s} width={previewW} className="flex-none rounded-[10px] shadow-[0_30px_70px_rgba(0,0,0,0.55)]" />
                ))}
              </div>
              <p className="text-xs text-muted">
                {multi ? `${editSlides.length} imágenes` : "1 imagen"} de {editSlides[0]?.width * (effective.hiRes ? 2 : 1)} × {editSlides[0]?.height * (effective.hiRes ? 2 : 1)} px
                {photo?.credit ? ` · Foto: ${photo.credit}` : ""}
                {designs.length > 1 ? " · ← → para cambiar de propuesta" : ""}
              </p>
            </div>
            <div role="group" aria-label="Propuestas" className="flex flex-none gap-2.5 lg:flex-col">
              {designs.map((d, i) => {
                const s = slidesFor(d, i === selected ? edit : undefined)[0];
                const isSaved = !!savedMatch(d);
                const label = getTemplate(d.templateId).label;
                return (
                  <button
                    key={`${seed}-${i}`}
                    type="button"
                    onClick={() => pick(i)}
                    aria-pressed={selected === i}
                    aria-label={`Propuesta ${i + 1}: ${label}${isSaved ? " (guardada)" : ""}`}
                    title={d.background === "patron" && d.pattern ? `${label} · ${d.pattern.layers.map(patternLabel).join(" + ")}` : label}
                    className={`flex flex-col gap-1.5 rounded-[10px] p-0.5 text-left text-xs transition-shadow ${selected === i ? "text-text ring-2 ring-accent ring-offset-2 ring-offset-ink" : "text-muted opacity-85 hover:opacity-100"}`}
                    style={{ width: thumbW + 4 }}
                  >
                    <SlidePreview spec={s} width={thumbW} className="rounded-md" />
                    <span className="flex items-center gap-1 truncate px-0.5">
                      {i + 1} · {label}
                      {isSaved ? <Star size={11} filled className="flex-none text-suggest" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </StudioLayout>
  );
}

function Chip({ children, suggest, title }: { children: React.ReactNode; suggest?: boolean; title?: string }) {
  return (
    <span title={title} className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${suggest ? "border-suggest-line text-suggest" : "border-line text-muted"}`}>
      {children}
    </span>
  );
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const sameSet = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x));

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
  patternDefaults,
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
  patternDefaults: ImageOptions["patterns"];
}) {
  const d = edit.design;
  const setD = (patch: Partial<Design>) => setEdit({ ...edit, design: { ...d, ...patch } });
  const setBackground = (b: BackgroundKind) =>
    setD({ background: b, pattern: b === "patron" ? (d.pattern ?? makePattern(patternDefaults, randomSeed())) : d.pattern });
  return (
    <div className="flex flex-col gap-4 text-sm">
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
        <select value={d.background} onChange={(e) => setBackground(e.target.value as BackgroundKind)} className="h-10 rounded-lg border border-line bg-ink px-2">
          {BACKGROUNDS.map((b) => (
            <option key={b.id} value={b.id} disabled={(b.id === "foto" && !hasPhotos) || (b.id === "ia" && !aiImages)}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {d.background === "patron" && d.pattern ? (
        <PatternTune pattern={d.pattern} setPattern={(pattern) => setD({ pattern })} defaults={patternDefaults} />
      ) : null}
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

/** Texto de la publicación: plantilla sin IA (sugerida), editable, o escrito por la IA si lo pides. */
function CaptionPanel({
  caption,
  edited,
  fromAi,
  showText,
  showTags,
  style,
  hasAi,
  aiBusy,
  onStyle,
  onVariant,
  onEdit,
  onReset,
  onAi,
}: {
  caption: Caption;
  edited: boolean;
  fromAi: boolean;
  showText: boolean;
  showTags: boolean;
  style: CaptionStyle;
  hasAi: boolean;
  aiBusy: boolean;
  onStyle: (s: CaptionStyle) => void;
  onVariant: () => void;
  onEdit: (c: Caption) => void;
  onReset: () => void;
  onAi: () => void;
}) {
  const full = [showText ? caption.texto : "", showTags ? caption.hashtags.join(" ") : ""].filter(Boolean).join("\n\n");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Texto para la publicación</h3>
        <span className="text-xs text-muted">{fromAi ? "Escrito por la IA" : edited ? "Editado por ti" : "Plantilla, sin IA"}</span>
      </div>
      {showText ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Estilo del texto">
          {CAPTION_STYLES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={style === c.id && !fromAi}
              title={c.hint}
              onClick={() => onStyle(c.id)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${style === c.id && !fromAi ? "border-accent bg-accent-soft" : "border-line text-muted hover:border-line-strong"}`}
            >
              {c.label} {c.id === "reflexion" ? <SuggestDot /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {showText ? (
        <textarea
          aria-label="Texto de la publicación"
          value={caption.texto}
          rows={5}
          onChange={(e) => onEdit({ ...caption, texto: e.target.value })}
          className="rounded-xl border border-line bg-ink p-3 leading-relaxed"
        />
      ) : null}
      {showTags ? (
        <TextInput
          aria-label="Hashtags"
          value={caption.hashtags.join(" ")}
          onChange={(e) => onEdit({ ...caption, hashtags: e.target.value.split(/\s+/).filter(Boolean) })}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-9"
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
        {showText ? (
          <Button className="h-9" onClick={onVariant} title="Otra frase de cierre del mismo estilo">
            <Dice size={15} />
            Otra versión
          </Button>
        ) : null}
        {edited ? (
          <button type="button" onClick={onReset} className="text-xs text-accent hover:underline">
            Volver a la plantilla
          </button>
        ) : null}
        {hasAi ? (
          <Button className="ml-auto h-9" onClick={onAi} busy={aiBusy}>
            {fromAi ? "Pedir otro a la IA" : "Escribirlo con IA"}
          </Button>
        ) : null}
      </div>
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

/** Ajuste del patrón de la propuesta elegida: capas, variación, intensidad y densidad. */
function PatternTune({
  pattern,
  setPattern,
  defaults,
}: {
  pattern: PatternDesign;
  setPattern: (p: PatternDesign) => void;
  defaults: ImageOptions["patterns"];
}) {
  const set = (patch: Partial<PatternDesign>) => setPattern({ ...pattern, ...patch });
  const toggle = (id: PatternId) => {
    const on = pattern.layers.includes(id);
    if (on && pattern.layers.length === 1) return;
    if (!on && pattern.layers.length >= 3) return;
    set({ layers: on ? pattern.layers.filter((l) => l !== id) : [...pattern.layers, id] });
  };
  const usesEmoji = pattern.layers.some((l) => l.startsWith("emoji"));
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="flex items-center justify-between">
        <span className="text-muted">Patrón</span>
        <Button className="h-8 px-3 text-sm" onClick={() => set({ seed: randomSeed() })}>
          <Dice size={15} />
          Otra variación
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Capas del patrón (hasta 3)">
        {PATTERNS.map((p) => {
          const on = pattern.layers.includes(p.id);
          const marked = defaults.kinds.includes(p.id);
          if (!on && !marked) return null;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p.id)}
              className={`rounded-full border px-2.5 py-1 text-xs ${on ? "border-accent bg-accent-soft" : "border-line text-muted hover:border-line-strong"}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <span className="-mt-1 text-xs text-muted">Hasta 3 capas. Se muestran los tipos marcados en el panel.</span>
      <div className="flex flex-col gap-1.5">
        <span className="text-muted">Intensidad</span>
        <div className="flex gap-1.5">
          {INTENSITIES.map((i) => (
            <button
              key={i.id}
              type="button"
              aria-pressed={pattern.intensity === i.id}
              onClick={() => set({ intensity: i.id as Intensity })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${pattern.intensity === i.id ? "border-accent bg-accent-soft" : "border-line"}`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="flex justify-between text-muted">
          Tamaño del patrón <span className="font-mono">{Math.round(pattern.scale * 100)}%</span>
        </span>
        <input type="range" min={0.5} max={2} step={0.1} value={pattern.scale} onChange={(e) => set({ scale: parseFloat(e.target.value) })} />
      </label>
      {usesEmoji ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-muted">Emojis</span>
          <TextInput value={pattern.emojis} maxLength={80} onChange={(e) => set({ emojis: e.target.value })} className="text-lg" />
        </label>
      ) : null}
    </div>
  );
}
