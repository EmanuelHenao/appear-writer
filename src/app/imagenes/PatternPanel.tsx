"use client";

import { Check, Choice, Section, SuggestDot, TextInput } from "@/components/ui";
import type { PatternOptions } from "@/design/compose";
import { INTENSITIES, PATTERN_GROUPS, PATTERNS, type Intensity, type PatternId } from "@/design/patterns";

/** Panel de patrones generativos: los tipos marcados son los únicos que se usan al generar. */
export function PatternPanel({
  value,
  suggested,
  onChange,
  active,
}: {
  value: PatternOptions;
  suggested: PatternOptions;
  onChange: (v: PatternOptions) => void;
  /** ¿Está marcado el fondo «Patrón generativo»? */
  active: boolean;
}) {
  const set = (patch: Partial<PatternOptions>) => onChange({ ...value, ...patch });
  const toggle = (id: PatternId, on: boolean) =>
    set({ kinds: on ? [...value.kinds, id] : value.kinds.filter((k) => k !== id) });
  const setGroup = (group: string, on: boolean) => {
    const ids = PATTERNS.filter((p) => p.group === group).map((p) => p.id as PatternId);
    const next = on ? Array.from(new Set([...value.kinds, ...ids])) : value.kinds.filter((k) => !ids.includes(k));
    if (next.length) set({ kinds: next });
  };
  const usesEmoji = value.kinds.some((k) => k.startsWith("emoji"));
  const isSuggested = JSON.stringify({ ...value, kinds: [...value.kinds].sort() }) === JSON.stringify({ ...suggested, kinds: [...suggested.kinds].sort() });
  const summary = active
    ? `${value.kinds.length} marcados · ${value.combine ? `${value.layers} capas` : "uno al azar"}`
    : "Fondo sin marcar";

  return (
    <Section title="Patrones" summary={summary} suggested={active && isSuggested}>
      <div className={`flex flex-col gap-3 ${active ? "" : "opacity-60"}`}>
        <p className="text-xs leading-relaxed text-muted">
          {active ? "" : "Marca el fondo «Patrón generativo» para usarlos. "}
          Solo los tipos marcados entran en la generación. Se dibujan con la paleta elegida y sin IA.
        </p>
        {PATTERN_GROUPS.map((g) => {
          const items = PATTERNS.filter((p) => p.group === g.id);
          const all = items.every((p) => value.kinds.includes(p.id));
          return (
            <div key={g.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{g.label}</span>
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => setGroup(g.id, !all)}>
                  {all ? "Quitar todos" : "Marcar todos"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {items.map((p) => {
                  const on = value.kinds.includes(p.id);
                  return (
                    <Check
                      key={p.id}
                      id={`pat-${p.id}`}
                      checked={on}
                      disabled={on && value.kinds.length === 1}
                      suggested={suggested.kinds.includes(p.id)}
                      hint={p.hint}
                      onChange={(v) => toggle(p.id, v)}
                    >
                      {p.label}
                    </Check>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">En cada imagen</span>
          <Choice name="pat-modo" value="uno" checked={!value.combine} suggested={!suggested.combine} onSelect={() => set({ combine: false })}>
            Un patrón al azar <span className="block text-xs text-muted">Elige uno de los marcados</span>
          </Choice>
          <Choice name="pat-modo" value="varios" checked={value.combine} disabled={value.kinds.length < 2} onSelect={() => set({ combine: true })}>
            Varios patrones superpuestos <span className="block text-xs text-muted">Combina los marcados en la misma imagen</span>
          </Choice>
          {value.combine ? (
            <div className="flex items-center gap-4 pl-1 text-sm">
              <span className="text-muted">Capas:</span>
              {[2, 3].map((n) => (
                <label key={n} className="flex items-center gap-1.5">
                  <input type="radio" name="pat-capas" checked={value.layers === n} disabled={value.kinds.length < n} onChange={() => set({ layers: n })} />
                  {n} {n === suggested.layers ? <SuggestDot /> : null}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Intensidad</span>
          <div className="grid grid-cols-3 gap-2">
            {INTENSITIES.map((i) => (
              <Choice key={i.id} name="pat-int" value={i.id} checked={value.intensity === i.id} suggested={suggested.intensity === i.id} onSelect={(v) => set({ intensity: v as Intensity })}>
                {i.label}
              </Choice>
            ))}
          </div>
        </div>

        {usesEmoji ? (
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-sm text-muted">
              Emojis a usar {value.emojis === suggested.emojis ? <SuggestDot /> : null}
            </span>
            <TextInput value={value.emojis} maxLength={80} onChange={(e) => set({ emojis: e.target.value })} placeholder="✨🌿🌙" className="text-lg" />
            <span className="text-xs text-muted">Si tu texto tiene emojis, se sugieren esos.</span>
          </label>
        ) : null}
      </div>
    </Section>
  );
}
