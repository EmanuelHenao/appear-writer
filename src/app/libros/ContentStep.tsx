"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "@/components/icons";
import { Button } from "@/components/ui";
import { isHighlighted, setBlockEdit, type BookEdits } from "@/book/edits";
import { editsSummary, filterRows, isFiltering, NO_FILTER, type Row, type RowFilter, type StateFilter } from "@/book/rows";
import { formatDate } from "@/book/structure";

const ROW_H = 52;
const CHAPTER_H = 32;
const LIST_H = 460;

const STATES: { id: StateFilter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "ocultos", label: "Ocultos" },
  { id: "destacados", label: "Destacados" },
  { id: "editados", label: "Editados" },
];

/**
 * Paso Contenido: la lista de mensajes con filtros, selección múltiple y
 * acciones en bloque. Un clic en una fila abre su ficha (el inspector).
 */
export function ContentStep({
  rows,
  edits,
  participants,
  selected,
  suggestions,
  onOpen,
  onChange,
  onSuggest,
}: {
  rows: Row[];
  edits: BookEdits;
  participants: string[];
  selected: string | null;
  suggestions: { hide: number; highlight: number };
  onOpen: (key: string) => void;
  onChange: (next: BookEdits) => void;
  onSuggest: () => void;
}) {
  const [filter, setFilter] = useState<RowFilter>(NO_FILTER);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [scroll, setScroll] = useState(0);
  const [more, setMore] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => filterRows(rows, filter, edits), [rows, filter, edits]);
  const blocks = useMemo(() => shown.filter((r) => r.kind === "block"), [shown]);
  const tops = useMemo(() => {
    const t: number[] = [];
    let y = 0;
    for (const r of shown) {
      t.push(y);
      y += r.kind === "chapter" ? CHAPTER_H : ROW_H;
    }
    t.push(y);
    return t;
  }, [shown]);
  const total = tops[tops.length - 1];
  const height = Math.min(LIST_H, Math.max(total, 120));
  // Solo se pintan las filas visibles: los chats tienen miles de mensajes.
  let first = 0;
  while (first < shown.length && tops[first + 1] < scroll) first++;
  let last = first;
  while (last < shown.length && tops[last] < scroll + height + 200) last++;

  const sum = editsSummary(edits);
  const totalBlocks = rows.filter((r) => r.kind === "block").length;
  const checkedVisible = blocks.filter((r) => checked.has(r.key));
  const allChecked = blocks.length > 0 && checkedVisible.length === blocks.length;

  function toggle(r: Row, i: number, shift: boolean) {
    const next = new Set(checked);
    const on = !next.has(r.key);
    if (shift && anchor !== null) {
      const [a, b] = [Math.min(anchor, i), Math.max(anchor, i)];
      for (const x of shown.slice(a, b + 1)) {
        if (x.kind !== "block") continue;
        if (on) next.add(x.key);
        else next.delete(x.key);
      }
    } else if (on) next.add(r.key);
    else next.delete(r.key);
    setChecked(next);
    setAnchor(i);
  }

  function bulk(patch: "ocultar" | "mostrar" | "destacar" | "normal" | "restablecer") {
    let e = edits;
    for (const k of checked) {
      if (patch === "ocultar") e = setBlockEdit(e, k, { hidden: true });
      else if (patch === "mostrar") e = setBlockEdit(e, k, { hidden: undefined });
      else if (patch === "destacar") e = setBlockEdit(e, k, { design: "cita", hidden: undefined });
      else if (patch === "normal") e = setBlockEdit(e, k, { design: undefined });
      else e = setBlockEdit(e, k, null);
    }
    onChange(e);
    setMore(false);
  }

  const summary = [
    `${totalBlocks.toLocaleString("es")} ${rows.some((r) => r.kind === "block" && r.isMessage) ? "mensajes" : "párrafos"}`,
    sum.hidden && `${sum.hidden} ${sum.hidden === 1 ? "oculto" : "ocultos"}`,
    sum.highlighted && `${sum.highlighted} ${sum.highlighted === 1 ? "destacado" : "destacados"}`,
    sum.inserts && `${sum.inserts} ${sum.inserts === 1 ? "página añadida" : "páginas añadidas"}`,
    sum.chapters && `${sum.chapters} ${sum.chapters === 1 ? "capítulo" : "capítulos"} a mano`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-muted">Decide qué entra en el libro. El original no se toca y todo se puede deshacer (Ctrl+Z).</p>
      <p className="flex flex-wrap gap-x-2 text-xs text-muted">
        {summary.map((s, i) => (
          <span key={i} className={i ? "text-text" : ""}>
            {i ? "· " : ""}
            {s}
          </span>
        ))}
      </p>

      {suggestions.hide + suggestions.highlight > 0 ? (
        <div className="flex items-center gap-3 rounded-[10px] border border-suggest-line bg-suggest/5 px-3 py-2.5">
          <span className="text-suggest" aria-hidden="true">
            ●
          </span>
          <span className="flex-1 text-[13px]">
            Sugerencias: {suggestions.hide ? <b>{suggestions.hide} para ocultar</b> : null}
            {suggestions.hide && suggestions.highlight ? " y " : null}
            {suggestions.highlight ? <b>{suggestions.highlight} para destacar</b> : null}
          </span>
          <Button className="h-8 border-suggest-line px-3 text-[13px] text-suggest" onClick={onSuggest}>
            Revisar
          </Button>
        </div>
      ) : null}

      <label className="flex h-10 items-center gap-2 rounded-[10px] border border-line-strong bg-ink px-3 text-muted focus-within:border-accent">
        <Search />
        <input
          type="search"
          value={filter.q}
          onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          placeholder="Buscar en los mensajes"
          aria-label="Buscar en los mensajes"
          className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
        {participants.length > 1 ? (
          <select
            value={filter.author}
            onChange={(e) => setFilter({ ...filter, author: e.target.value })}
            aria-label="Persona"
            className="h-8 rounded-full border border-line-strong bg-ink px-2.5"
          >
            <option value="">Persona: todas</option>
            {participants.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex h-8 items-center gap-1 rounded-full border border-line-strong bg-ink pl-2.5 pr-1 text-muted">
          Desde
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} className="bg-transparent text-text" aria-label="Desde" />
        </label>
        <label className="flex h-8 items-center gap-1 rounded-full border border-line-strong bg-ink pl-2.5 pr-1 text-muted">
          Hasta
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} className="bg-transparent text-text" aria-label="Hasta" />
        </label>
        <Chip on={filter.photos} onClick={() => setFilter({ ...filter, photos: !filter.photos })}>
          Con fotos
        </Chip>
        {STATES.map((s) => (
          <Chip key={s.id} on={filter.state === s.id} onClick={() => setFilter({ ...filter, state: s.id })}>
            {s.label}
          </Chip>
        ))}
        {isFiltering(filter) ? (
          <button type="button" onClick={() => setFilter(NO_FILTER)} className="px-1.5 text-xs text-accent hover:underline">
            Quitar filtros
          </button>
        ) : null}
      </div>

      {checked.size ? (
        <div className="relative flex flex-wrap items-center gap-1.5 rounded-[10px] border border-accent/40 bg-accent-soft px-2.5 py-2">
          <span className="flex-1 text-[13px] font-semibold">
            {checked.size} {checked.size === 1 ? "seleccionado" : "seleccionados"}
          </span>
          <Button className="h-8 px-3 text-[13px]" onClick={() => bulk("ocultar")}>
            Ocultar
          </Button>
          <Button className="h-8 px-3 text-[13px]" onClick={() => bulk("destacar")}>
            Destacar
          </Button>
          <Button className="h-8 px-3 text-[13px]" aria-expanded={more} onClick={() => setMore(!more)}>
            Más
          </Button>
          <button type="button" aria-label="Quitar la selección" onClick={() => setChecked(new Set())} className="h-8 w-8 rounded-lg text-muted hover:bg-panel-2 hover:text-text">
            ×
          </button>
          {more ? (
            <div className="absolute right-2 top-[calc(100%+4px)] z-20 flex w-48 flex-col rounded-[10px] border border-line-strong bg-panel-2 p-1 text-[13px] shadow-xl">
              {(
                [
                  ["mostrar", "Mostrar"],
                  ["normal", "Quitar el destacado"],
                  ["restablecer", "Restablecer todo"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} type="button" onClick={() => bulk(id)} className="rounded-md px-2.5 py-2 text-left hover:bg-panel">
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-line bg-ink">
        <div className="flex items-center gap-2.5 border-b border-line bg-panel-2/60 px-3 py-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => setChecked(allChecked ? new Set() : new Set(blocks.map((r) => r.key)))}
            aria-label={allChecked ? "Quitar la selección" : "Seleccionar todo lo que se ve"}
          />
          <span className="flex-1">{isFiltering(filter) ? `${blocks.length.toLocaleString("es")} de ${totalBlocks.toLocaleString("es")}` : "Todo el libro"}</span>
          <span>Mayús + clic marca un tramo</span>
        </div>
        <div ref={list} className="scroll-thin relative overflow-y-auto" style={{ height }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
          {!shown.length ? <p className="p-6 text-center text-sm text-muted">Nada coincide con los filtros.</p> : null}
          <div style={{ height: total, position: "relative" }}>
            {shown.slice(first, last).map((r, j) => {
              const i = first + j;
              const style = { position: "absolute" as const, top: tops[i], left: 0, right: 0, height: r.kind === "chapter" ? CHAPTER_H : ROW_H };
              if (r.kind === "chapter")
                return (
                  <div key={r.key} style={style} className="flex items-center gap-2 border-b border-line bg-panel px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    <span className="truncate">{r.title}</span>
                    {r.manual ? <span className="rounded-full border border-accent/50 px-1.5 text-[10px] normal-case tracking-normal text-accent">a mano</span> : null}
                  </div>
                );
              if (r.kind === "insert")
                return (
                  <button
                    key={r.key}
                    type="button"
                    style={style}
                    onClick={() => onOpen(r.key)}
                    className={`grid grid-cols-[18px_1fr] items-center gap-2.5 border-b border-line/70 px-3 text-left ${selected === r.key ? "bg-accent-soft" : "bg-panel/40 hover:bg-panel"}`}
                  >
                    <span className="text-center text-accent">+</span>
                    <span className="min-w-0">
                      <span className="block text-xs text-accent">Página añadida</span>
                      <span className="block truncate text-[13.5px]">{r.label}</span>
                    </span>
                  </button>
                );
              const e = edits.blocks[r.key];
              return (
                <div
                  key={r.key}
                  style={style}
                  className={`grid grid-cols-[18px_1fr_auto] items-center gap-2.5 border-b border-line/70 px-3 ${selected === r.key ? "bg-accent-soft shadow-[inset_3px_0_0_var(--color-accent)]" : "hover:bg-panel"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(r.key)}
                    onChange={() => undefined}
                    onClick={(ev) => toggle(r, i, ev.shiftKey)}
                    aria-label="Seleccionar"
                  />
                  <button type="button" onClick={() => onOpen(r.key)} className={`min-w-0 text-left ${e?.hidden ? "opacity-50" : ""}`}>
                    <span className="block truncate text-xs text-muted">
                      {[r.author, r.date ? formatDate(r.date, true) : ""].filter(Boolean).join(" · ") || "Párrafo"}
                    </span>
                    <span className={`block truncate text-[13.5px] ${e?.hidden ? "line-through" : ""}`}>{(e?.runs ? e.runs.map((x) => x.t).join("") : r.text) || (r.media.length ? "Foto" : "—")}</span>
                  </button>
                  <span className="flex gap-1">
                    {e?.hidden ? <Badge>Oculto</Badge> : null}
                    {isHighlighted(e) ? <Badge tone="suggest">{e?.design === "cita" ? "★ Cita" : "★ Foto"}</Badge> : null}
                    {e?.chapter ? <Badge tone="accent">Capítulo</Badge> : null}
                    {!e?.hidden && !isHighlighted(e) && r.media.length ? <Badge>{r.media.length === 1 ? "1 foto" : `${r.media.length} fotos`}</Badge> : null}
                    {e?.runs ? <Badge>editado</Badge> : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-8 rounded-full border px-3 ${on ? "border-accent bg-accent-soft text-text" : "border-line-strong bg-ink text-muted hover:text-text"}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone }: { children: React.ReactNode; tone?: "suggest" | "accent" }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full border px-1.5 py-px text-[11px] ${
        tone === "suggest" ? "border-suggest-line text-suggest" : tone === "accent" ? "border-accent/50 text-accent" : "border-line-strong text-muted"
      }`}
    >
      {children}
    </span>
  );
}
