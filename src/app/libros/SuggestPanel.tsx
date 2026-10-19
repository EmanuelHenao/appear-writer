"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft } from "@/components/icons";
import { Button, SuggestDot } from "@/components/ui";
import { setBlockEdit, type BookEdits } from "@/book/edits";
import type { Row } from "@/book/rows";
import type { Suggestion } from "@/book/suggest";

/**
 * Sugerencias sin IA para ocultar o destacar. Cada grupo tiene su casilla
 * (los marcados con ● vienen activos) y se puede abrir para quitar
 * mensajes sueltos. Nada se aplica hasta pulsar el botón.
 */
export function SuggestPanel({
  suggestions,
  rows,
  edits,
  onApply,
  onClose,
}: {
  suggestions: Suggestion[];
  rows: Row[];
  edits: BookEdits;
  onApply: (next: BookEdits) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Suggestion["kind"]>(suggestions.some((s) => s.kind === "ocultar") ? "ocultar" : "destacar");
  const [on, setOn] = useState<Set<string>>(() => new Set(suggestions.filter((s) => s.suggested).map((s) => s.id)));
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const picked = (kind: Suggestion["kind"]) => {
    const keys = new Set<string>();
    for (const s of suggestions) if (s.kind === kind && on.has(s.id)) for (const k of s.keys) if (!skip.has(k)) keys.add(k);
    return keys;
  };
  const hide = picked("ocultar");
  const highlight = picked("destacar");

  function apply() {
    let e = edits;
    for (const k of hide) e = setBlockEdit(e, k, { hidden: true });
    for (const k of highlight) if (!hide.has(k)) e = setBlockEdit(e, k, { design: "cita" });
    onApply(e);
  }

  const list = suggestions.filter((s) => s.kind === tab);
  const label = [hide.size && `Ocultar ${hide.size}`, highlight.size && `destacar ${highlight.size}`].filter(Boolean).join(" y ");

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onClose} className="flex items-center gap-1 self-start rounded-lg py-1.5 pr-2 text-[13px] text-muted hover:text-text">
        <ChevronLeft /> Volver a la lista
      </button>
      <div>
        <h2 className="font-display text-xl font-bold">Sugerencias</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Salen de reglas fijas, sin IA. Lo marcado con <SuggestDot /> es lo que te proponemos; tú decides qué se aplica y luego puedes deshacerlo.
        </p>
      </div>
      <div role="tablist" className="grid grid-cols-2 overflow-hidden rounded-lg border border-line-strong text-[13px]">
        {(["ocultar", "destacar"] as const).map((k) => {
          const n = suggestions.filter((s) => s.kind === k).reduce((a, s) => a + s.keys.length, 0);
          return (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`h-9 ${tab === k ? "bg-accent-soft font-semibold text-text" : "text-muted hover:text-text"}`}>
              {k === "ocultar" ? "Ocultar" : "Destacar"} · {n}
            </button>
          );
        })}
      </div>
      {!list.length ? <p className="text-sm text-muted">No hay nada que proponer aquí.</p> : null}
      <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-ink">
        {list.map((s) => (
          <div key={s.id} className="border-b border-line/70 last:border-0">
            <div className="flex items-start gap-2.5 px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={on.has(s.id)}
                onChange={() => {
                  const n = new Set(on);
                  if (n.has(s.id)) n.delete(s.id);
                  else n.add(s.id);
                  setOn(n);
                }}
                aria-label={s.label}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {s.label} {s.suggested ? <SuggestDot /> : null}
                </div>
                <div className="truncate text-xs text-muted">{s.hint}</div>
              </div>
              <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id} className="flex items-center gap-1 text-xs text-muted hover:text-text">
                {s.keys.length}
                <ChevronDown className={open === s.id ? "rotate-180" : ""} />
              </button>
            </div>
            {open === s.id ? (
              <div className="scroll-thin max-h-56 overflow-y-auto border-t border-line/70 bg-panel/40">
                {s.keys.map((k) => {
                  const r = byKey.get(k);
                  if (!r || r.kind !== "block") return null;
                  return (
                    <label key={k} className="flex items-center gap-2.5 px-3 py-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        checked={!skip.has(k)}
                        onChange={() => {
                          const n = new Set(skip);
                          if (n.has(k)) n.delete(k);
                          else n.add(k);
                          setSkip(n);
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-muted">{r.author} · </span>
                        {r.text || "Foto"}
                      </span>
                      <span className="text-xs text-muted">{r.date?.slice(0, 10)}</span>
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button className="h-10" onClick={() => setOn(new Set())}>
          Ninguna
        </Button>
        <Button variant="primary" className="h-10 flex-1" disabled={!hide.size && !highlight.size} onClick={apply}>
          {label ? `${label} ${hide.size + highlight.size === 1 ? "mensaje" : "mensajes"}` : "Marca alguna sugerencia"}
        </Button>
      </div>
    </div>
  );
}
