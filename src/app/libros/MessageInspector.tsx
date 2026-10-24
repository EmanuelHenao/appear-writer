"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Close, Eye, EyeOff, PagePlus, Star } from "@/components/icons";
import { OwnPhotos } from "@/components/OwnPhotos";
import { Button, Check, Choice, TextInput } from "@/components/ui";
import { hasFormat, plainToRuns, runsToPlain, setBlockEdit, type BlockDesign, type BookEdits, type Insert, type Run } from "@/book/edits";
import type { Block } from "@/book/model";
import { metaFlags, shownName, type BookOptions } from "@/book/options";
import { formatDate } from "@/book/structure";
import { RichText, type Palette } from "./RichText";

const DESIGNS: { id: BlockDesign; label: string; needsPhoto?: boolean }[] = [
  { id: "normal", label: "Normal" },
  { id: "cita", label: "Cita" },
  { id: "foto-completa", label: "Foto completa", needsPhoto: true },
  { id: "foto-texto", label: "Foto + texto", needsPhoto: true },
];

const INSERT_KINDS: { id: Insert["kind"]; label: string; hint: string }[] = [
  { id: "separador", label: "Separador", hint: "Ornamento y título" },
  { id: "libre", label: "Página libre", hint: "Tu propio texto" },
  { id: "imagen", label: "Imagen", hint: "Una de tus fotos" },
  { id: "blanco", label: "En blanco", hint: "Para cuadrar páginas" },
];

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export interface InspectorProps {
  bookId: string;
  itemKey: string;
  block: Block | null;
  edits: BookEdits;
  onChange: (next: BookEdits, coalesce?: string) => void;
  palette: Palette;
  baseFont: string;
  page: number | null;
  /** El libro está en «Uno por página»: se pueden juntar mensajes en una página. */
  onePerPage: boolean;
  /** Opciones del libro: nombres de las personas y qué datos lleva cada mensaje por defecto. */
  options: BookOptions;
  position: { index: number; total: number };
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onOpen: (key: string) => void;
}

/** Ficha del mensaje (o de una página añadida) elegido en la lista o la vista previa. */
export function MessageInspector(p: InspectorProps) {
  const { itemKey, edits, onChange, onPrev, onNext, onClose } = p;
  const ins = itemKey.startsWith("ins:") ? edits.inserts.find((x) => `ins:${x.id}` === itemKey) : undefined;
  const edit = edits.blocks[itemKey];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
      else if (!ins && e.key.toLowerCase() === "h") onChange(setBlockEdit(edits, itemKey, { hidden: edit?.hidden ? undefined : true }));
      else if (!ins && e.key.toLowerCase() === "d" && p.block?.type === "message")
        onChange(setBlockEdit(edits, itemKey, { design: edit?.design === "cita" ? undefined : "cita", hidden: undefined }));
      else if (!ins && e.key.toLowerCase() === "j" && p.onePerPage && p.block?.type === "message") onChange(setBlockEdit(edits, itemKey, { join: edit?.join ? undefined : true }));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edits, edit, ins, itemKey, onChange, onClose, onNext, onPrev, p.block, p.onePerPage]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-lg py-1.5 pr-2 text-[13px] text-muted hover:text-text">
          <ChevronLeft /> Volver a la lista
        </button>
        <span className="flex-1" />
        <IconBtn label="Anterior (←)" onClick={onPrev} disabled={p.position.index <= 0}>
          <ChevronLeft />
        </IconBtn>
        <span className="font-mono text-xs tabular-nums text-muted">
          {(p.position.index + 1).toLocaleString("es")} de {p.position.total.toLocaleString("es")}
        </span>
        <IconBtn label="Siguiente (→)" onClick={onNext} disabled={p.position.index >= p.position.total - 1}>
          <ChevronRight />
        </IconBtn>
      </div>
      {ins ? <InsertEditor {...p} ins={ins} /> : p.block ? <BlockEditor {...p} block={p.block} /> : <p className="text-sm text-muted">Este elemento ya no existe.</p>}
    </div>
  );
}

function BlockEditor({ bookId, itemKey, block, edits, onChange, palette, baseFont, page, onePerPage, options, onOpen }: InspectorProps & { block: Block }) {
  const e = edits.blocks[itemKey];
  const set = (patch: Parameters<typeof setBlockEdit>[2], coalesce?: string) => onChange(setBlockEdit(edits, itemKey, patch), coalesce);
  const isMsg = block.type === "message";
  const original = block.type === "message" || block.type === "paragraph" ? block.text : "";
  const media = block.type === "message" ? block.media : [];
  const hiddenPhotos = new Set(e?.photos?.hidden ?? []);
  const design = e?.design ?? "normal";
  const runs: Run[] = e?.runs ?? plainToRuns(original);
  const [chapterOpen, setChapterOpen] = useState(!!e?.chapter);
  const inserts = edits.inserts.filter((x) => x.at === itemKey);

  function setRuns(next: Run[]) {
    // Si el texto vuelve a ser el original y sin formato, deja de contar como editado.
    const same = runsToPlain(next) === original && !hasFormat(next);
    set({ runs: same ? undefined : next }, `text:${itemKey}`);
  }

  function addInsert(side: Insert["side"]) {
    const id = Math.random().toString(36).slice(2, 10);
    onChange({ ...edits, inserts: [...edits.inserts, { id, at: itemKey, side, kind: "separador", title: "" }] });
    onOpen(`ins:${id}`);
  }

  return (
    <>
      <div>
        <div className="text-xs text-muted">
          {[isMsg ? shownName(options, block.author) : "Párrafo", isMsg && block.date ? formatDate(block.date, true) : "", page ? `página ${page}` : ""].filter(Boolean).join(" · ")}
        </div>
        <h2 className="font-display text-xl font-bold">{isMsg ? "Mensaje" : "Párrafo"}</h2>
      </div>

      <div className={`grid gap-1.5 ${isMsg ? "grid-cols-3" : "grid-cols-2"}`}>
        <Big on={!!e?.hidden} onClick={() => set({ hidden: e?.hidden ? undefined : true })} kbd="H">
          {e?.hidden ? <Eye /> : <EyeOff />}
          {e?.hidden ? "Mostrar" : "Ocultar"}
        </Big>
        {isMsg ? (
          <Big on={design === "cita"} onClick={() => set({ design: design === "cita" ? undefined : "cita", hidden: undefined })} kbd="D">
            <Star filled={design === "cita"} size={15} />
            {design === "cita" ? "Destacado" : "Destacar"}
          </Big>
        ) : null}
        <Big
          on={!!e?.chapter}
          onClick={() => {
            if (e?.chapter) {
              set({ chapter: undefined });
              setChapterOpen(false);
            } else {
              set({ chapter: { title: "" } });
              setChapterOpen(true);
            }
          }}
        >
          <Bookmark size={15} />
          Capítulo aquí
        </Big>
      </div>
      {e?.hidden ? <p className="-mt-2 text-xs text-muted">Oculto: no aparece en el PDF, el EPUB ni las imágenes.</p> : null}

      {e?.chapter || chapterOpen ? (
        <Card title="Nuevo capítulo" summary="Empieza en este mensaje">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Título</span>
            <TextInput value={e?.chapter?.title ?? ""} maxLength={160} placeholder="Por ejemplo: El viaje" onChange={(ev) => set({ chapter: { ...e?.chapter, title: ev.target.value } }, `chap:${itemKey}`)} autoFocus={!e?.chapter?.title} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Subtítulo (opcional)</span>
            <TextInput value={e?.chapter?.subtitle ?? ""} maxLength={200} onChange={(ev) => set({ chapter: { title: e?.chapter?.title ?? "", subtitle: ev.target.value || undefined } }, `chap:${itemKey}`)} />
          </label>
          <p className="text-xs text-muted">Usa el diseño de apertura de capítulo del libro y entra en el índice. La regla automática sigue en el resto del libro.</p>
        </Card>
      ) : null}

      {isMsg ? (
        <Card title="Diseño de la página" summary={`${DESIGNS.find((d) => d.id === design)?.label}${design === "normal" ? " ●" : ""}`}>
          <div className="grid grid-cols-4 gap-2">
            {DESIGNS.map((d) => {
              const disabled = d.needsPhoto && !media.length;
              const on = design === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  title={disabled ? "Este mensaje no tiene fotos" : d.label}
                  onClick={() => set({ design: d.id === "normal" ? undefined : d.id, hidden: undefined, photoText: d.id === "foto-completa" ? e?.photoText : undefined })}
                  className="flex flex-col items-center gap-1.5 text-[11.5px] text-muted disabled:opacity-35"
                >
                  <DesignThumb id={d.id} on={on} />
                  <span className={on ? "text-text" : ""}>
                    {d.label}
                    {d.id === "normal" ? " ●" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {design === "foto-completa" ? (
            <div className="grid grid-cols-2 gap-2">
              <Choice name={`pt-${itemKey}`} value="siguiente" checked={e?.photoText !== "encima"} onSelect={() => set({ photoText: undefined })} suggested>
                <span className="text-[13px]">Texto en la página siguiente</span>
              </Choice>
              <Choice name={`pt-${itemKey}`} value="encima" checked={e?.photoText === "encima"} onSelect={() => set({ photoText: "encima" })}>
                <span className="text-[13px]">Texto sobre la foto</span>
              </Choice>
            </div>
          ) : null}
          {onePerPage && design === "normal" ? (
            <Check
              id={`join-${itemKey}`}
              checked={!!e?.join}
              onChange={(v) => set({ join: v || undefined })}
              hint="Repítelo en los siguientes para poner varios en la misma página. Si no caben, pasan a texto corrido."
            >
              <span className="text-[13px]">
                Juntar el siguiente mensaje en esta página <kbd className="ml-1 font-mono text-[10px] text-muted">J</kbd>
              </span>
            </Check>
          ) : null}
        </Card>
      ) : null}

      {isMsg ? <MetaCard options={options} meta={e?.meta} hasDate={!!block.date} onChange={(meta) => set({ meta })} /> : null}

      {media.length ? (
        <Card title="Fotos" summary={`${media.length - hiddenPhotos.size} de ${media.length}${design === "normal" ? ` · ${PLACE_LABEL[e?.photos?.place ?? "junto"]}` : ""}`}>
          <div className="flex flex-wrap gap-2">
            {media.map((m) => {
              const off = hiddenPhotos.has(m);
              return (
                <div key={m} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/files/books/${bookId}/media/${encodeURIComponent(m)}`} alt="" className={`h-16 w-16 rounded-md object-cover ${off ? "opacity-30 grayscale" : ""}`} />
                  <button
                    type="button"
                    aria-label={off ? "Volver a poner esta foto" : "Quitar esta foto"}
                    title={off ? "Volver a ponerla" : "Quitarla"}
                    onClick={() => {
                      const next = new Set(hiddenPhotos);
                      if (off) next.delete(m);
                      else next.add(m);
                      set({ photos: { place: e?.photos?.place ?? "junto", hidden: [...next] } });
                    }}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/85 text-[11px] text-text"
                  >
                    {off ? "↺" : <Close size={11} />}
                  </button>
                </div>
              );
            })}
          </div>
          {design === "normal" ? (
            <div role="group" aria-label="Dónde van las fotos" className="grid grid-cols-3 overflow-hidden rounded-lg border border-line-strong text-[12.5px]">
              {(["junto", "antes", "ambas"] as const).map((pl) => {
                const on = (e?.photos?.place ?? "junto") === pl;
                return (
                  <button key={pl} type="button" aria-pressed={on} onClick={() => set({ photos: { hidden: [...hiddenPhotos], place: pl } })} className={`h-9 ${on ? "bg-accent-soft text-text" : "text-muted hover:text-text"}`}>
                    {PLACE_LABEL[pl]}
                    {pl === "junto" ? " ●" : ""}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted">Con este diseño, las fotos van en la página del mensaje.</p>
          )}
        </Card>
      ) : null}

      {original || e?.runs ? (
        <Card title="Texto" summary={e?.runs ? "editado" : "original"} action={e?.runs ? <button type="button" onClick={() => set({ runs: undefined })} className="text-xs text-accent hover:underline">Volver al original</button> : undefined}>
          <RichText runs={runs} onChange={setRuns} palette={palette} baseFont={baseFont} align={e?.align} onAlign={(a) => set({ align: a })} label="Texto del mensaje" />
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        {inserts.map((x) => (
          <button key={x.id} type="button" onClick={() => onOpen(`ins:${x.id}`)} className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-left text-[13px] hover:border-line-strong">
            <span className="text-accent">+</span>
            <span className="flex-1">
              {INSERT_KINDS.find((k) => k.id === x.kind)?.label}
              {x.title ? ` · «${x.title}»` : ""} <span className="text-muted">({x.side === "antes" ? "antes" : "después"})</span>
            </span>
            <ChevronRight />
          </button>
        ))}
        <div className="grid grid-cols-2 gap-1.5">
          <Button className="h-10" onClick={() => addInsert("antes")}>
            <PagePlus size={15} /> Página antes
          </Button>
          <Button className="h-10" onClick={() => addInsert("despues")}>
            <PagePlus size={15} /> Página después
          </Button>
        </div>
      </div>

      {e ? (
        <button type="button" onClick={() => onChange(setBlockEdit(edits, itemKey, null))} className="self-start text-xs text-muted hover:text-danger">
          Restablecer este mensaje
        </button>
      ) : null}
    </>
  );
}

const PLACE_LABEL = { junto: "Junto", antes: "Página antes", ambas: "Ambas" } as const;

type Meta = NonNullable<BookEdits["blocks"][string]["meta"]>;

/** Nombre, fecha y hora de este mensaje. Parten de lo elegido para el libro (●); solo se guarda lo que difiere. */
function MetaCard({ options, meta, hasDate, onChange }: { options: BookOptions; meta: Meta | undefined; hasDate: boolean; onChange: (meta: Meta | undefined) => void }) {
  const book = metaFlags(options);
  const now = metaFlags(options, meta);
  const custom = (["name", "date", "time"] as const).some((k) => meta?.[k] !== undefined);
  function toggle(k: keyof Meta, v: boolean) {
    const next: Meta = { ...meta, [k]: v === book[k] ? undefined : v };
    onChange(next.name === undefined && next.date === undefined && next.time === undefined ? undefined : next);
  }
  const rows: { k: keyof Meta; label: string; disabled?: boolean }[] = [
    { k: "name", label: "Nombre de quien escribe" },
    { k: "date", label: "Fecha", disabled: !hasDate },
    { k: "time", label: "Hora", disabled: !hasDate },
  ];
  return (
    <Card
      title="Datos del mensaje"
      summary={custom ? "a medida" : "como el libro ●"}
      action={custom ? <button type="button" onClick={() => onChange(undefined)} className="text-xs text-accent hover:underline">Como el libro</button> : undefined}
    >
      <div className="flex flex-col gap-2 text-[13px]">
        {rows.map((r) => (
          <Check key={r.k} id={`meta-${r.k}`} checked={now[r.k]} disabled={r.disabled} onChange={(v) => toggle(r.k, v)} suggested={now[r.k] === book[r.k]}>
            {r.label}
          </Check>
        ))}
      </div>
    </Card>
  );
}

function InsertEditor({ edits, onChange, palette, baseFont, onClose, ins }: InspectorProps & { ins: Insert }) {
  const set = (patch: Partial<Insert>, coalesce?: string) => onChange({ ...edits, inserts: edits.inserts.map((x) => (x.id === ins.id ? { ...x, ...patch } : x)) }, coalesce);
  return (
    <>
      <div>
        <div className="text-xs text-muted">{ins.side === "antes" ? "Antes" : "Después"} de su mensaje</div>
        <h2 className="font-display text-xl font-bold">Página añadida</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {INSERT_KINDS.map((k) => (
          <Choice key={k.id} name={`kind-${ins.id}`} value={k.id} checked={ins.kind === k.id} onSelect={() => set({ kind: k.id })}>
            <span className="block text-sm">{k.label}</span>
            <span className="block text-xs text-muted">{k.hint}</span>
          </Choice>
        ))}
      </div>
      {ins.kind === "separador" ? (
        <Card title="Separador" summary="No abre capítulo">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Título</span>
            <TextInput value={ins.title ?? ""} maxLength={160} placeholder="Por ejemplo: El viaje" onChange={(e) => set({ title: e.target.value }, `ins:${ins.id}:t`)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Línea pequeña (opcional)</span>
            <TextInput value={ins.caption ?? ""} maxLength={200} placeholder="Marzo de 2023" onChange={(e) => set({ caption: e.target.value || undefined }, `ins:${ins.id}:c`)} />
          </label>
          <p className="text-xs text-muted">Una pausa decorativa: no entra en el índice. Para un capítulo, usa «Capítulo aquí» en el mensaje.</p>
        </Card>
      ) : null}
      {ins.kind === "libre" ? (
        <Card title="Página libre" summary="Tu texto">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">Título (opcional)</span>
            <TextInput value={ins.title ?? ""} maxLength={160} onChange={(e) => set({ title: e.target.value || undefined }, `ins:${ins.id}:t`)} />
          </label>
          <RichText runs={ins.runs ?? []} onChange={(runs) => set({ runs }, `ins:${ins.id}:r`)} palette={palette} baseFont={baseFont} placeholder="Escribe aquí. Deja una línea en blanco entre párrafos." label="Texto de la página" />
        </Card>
      ) : null}
      {ins.kind === "imagen" ? (
        <Card title="Imagen" summary={ins.photo ? (ins.fit === "enmarcada" ? "Enmarcada" : "A página completa") : "Sin elegir"}>
          <OwnPhotos selected={ins.photo ? [ins.photo.url] : []} onToggle={(ph, on) => set({ photo: on ? { url: ph.url, thumb: ph.thumb } : undefined })} title="Elige una de tus fotos" />
          <div className="grid grid-cols-2 gap-2">
            <Choice name={`fit-${ins.id}`} value="completa" checked={ins.fit !== "enmarcada"} onSelect={() => set({ fit: undefined })} suggested>
              <span className="text-[13px]">A página completa</span>
            </Choice>
            <Choice name={`fit-${ins.id}`} value="enmarcada" checked={ins.fit === "enmarcada"} onSelect={() => set({ fit: "enmarcada" })}>
              <span className="text-[13px]">Enmarcada con pie</span>
            </Choice>
          </div>
          {ins.fit === "enmarcada" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">Pie de foto</span>
              <TextInput value={ins.caption ?? ""} maxLength={200} onChange={(e) => set({ caption: e.target.value || undefined }, `ins:${ins.id}:c`)} />
            </label>
          ) : null}
        </Card>
      ) : null}
      {ins.kind === "blanco" ? <p className="text-sm text-muted">Una página vacía, sin número. Sirve para que lo siguiente empiece en página derecha.</p> : null}
      <div className="flex items-center gap-2">
        <Button className="h-9" onClick={() => set({ side: ins.side === "antes" ? "despues" : "antes" })}>
          Mover {ins.side === "antes" ? "después" : "antes"} del mensaje
        </Button>
        <span className="flex-1" />
        <Button
          variant="danger"
          className="h-9"
          onClick={() => {
            onChange({ ...edits, inserts: edits.inserts.filter((x) => x.id !== ins.id) });
            onClose();
          }}
        >
          Quitar la página
        </Button>
      </div>
    </>
  );
}

function Card({ title, summary, action, children }: { title: string; summary?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-ink/50 p-3">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold">
        <span>{title}</span>
        <span className="flex items-center gap-2 text-xs font-normal text-muted">
          {summary}
          {action}
        </span>
      </div>
      {children}
    </section>
  );
}

function Big({ on, onClick, kbd, children }: { on: boolean; onClick: () => void; kbd?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-[10px] border text-[13px] ${on ? "border-accent bg-accent-soft text-text" : "border-line-strong bg-panel-2 hover:border-accent/60"}`}
    >
      {children}
      {kbd ? <kbd className="font-mono text-[10px] text-muted">{kbd}</kbd> : null}
    </button>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-text disabled:opacity-30">
      {children}
    </button>
  );
}

/** Miniatura de cada diseño, dibujada como una página del libro. */
function DesignThumb({ id, on }: { id: BlockDesign; on: boolean }) {
  const line = (w: number, c = "#2A2622", h = 3) => <span style={{ width: w, height: h, background: c, display: "block" }} />;
  return (
    <span className={`flex h-[78px] w-[56px] flex-col items-center justify-center gap-1 overflow-hidden rounded-[3px] border-2 bg-[#F4EFE4] ${on ? "border-accent" : "border-transparent"}`}>
      {id === "normal" ? (
        <>
          {line(34)}
          {line(30)}
          {line(20, "#8A7F6E", 2)}
        </>
      ) : null}
      {id === "cita" ? (
        <>
          <span className="text-[13px] leading-none text-[#C9A45C]">“</span>
          {line(36, "#2A2622", 4)}
          {line(28, "#2A2622", 4)}
          {line(10, "#C9A45C", 1)}
        </>
      ) : null}
      {id === "foto-completa" ? <span className="h-full w-full bg-[#5f7268]" /> : null}
      {id === "foto-texto" ? (
        <>
          <span className="block h-[30px] w-[40px] bg-[#9aa79f]" />
          {line(32)}
          {line(24)}
        </>
      ) : null}
    </span>
  );
}
