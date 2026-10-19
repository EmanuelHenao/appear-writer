"use client";

import { useState } from "react";
import { Button, Notice, SuggestDot } from "@/components/ui";

interface Issue {
  word: string;
  count: number;
  suggestions: string[];
  kind: "tilde" | "jerga" | "otra";
  example: string;
}

const KIND_LABEL: Record<Issue["kind"], string> = { tilde: "Falta una tilde o ñ", jerga: "Abreviatura de chat", otra: "Palabra desconocida" };

/**
 * Revisión ortográfica sin IA. El diccionario solo propone: vienen marcadas
 * (●) las tildes que faltan, que casi siempre aciertan, y nada se cambia
 * hasta pulsar «Aplicar». El texto original de las fuentes no se toca.
 */
export function SpellCheck({ bookId, fixes, onApply }: { bookId: string; fixes: Record<string, string>; onApply: (fixes: Record<string, string>) => void }) {
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [on, setOn] = useState<Record<string, boolean>>({});

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/books/${bookId}/spelling`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const list: Issue[] = data.issues.filter((i: Issue) => !fixes[i.word]);
      setIssues(list);
      setPick(Object.fromEntries(list.map((i) => [i.word, i.suggestions[0]])));
      setOn(Object.fromEntries(list.map((i) => [i.word, i.kind === "tilde"])));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const marked = issues?.filter((i) => on[i.word] && pick[i.word]) ?? [];
  const applied = Object.entries(fixes);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs leading-relaxed text-muted">
        Con un diccionario de español en tu servidor, sin IA. Solo se cambian las palabras que marques, y el original se conserva.
      </p>
      <Button className="h-9 self-start" busy={busy} onClick={run}>
        {issues ? "Revisar otra vez" : "Revisar el texto"}
      </Button>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {issues && !issues.length ? <Notice tone="ok">No encontré palabras dudosas.</Notice> : null}
      {issues?.length ? (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-muted">{issues.length} dudosas</span>
            <button type="button" className="text-accent hover:underline" onClick={() => setOn(Object.fromEntries(issues.map((i) => [i.word, i.kind === "tilde"])))}>
              Solo las tildes
            </button>
            <button type="button" className="text-accent hover:underline" onClick={() => setOn(Object.fromEntries(issues.map((i) => [i.word, true])))}>
              Todas
            </button>
            <button type="button" className="text-accent hover:underline" onClick={() => setOn({})}>
              Ninguna
            </button>
          </div>
          <ul className="scroll-thin flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
            {issues.map((i) => (
              <li key={i.word} className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${on[i.word] ? "border-accent/60 bg-accent-soft" : "border-line"}`} title={i.example}>
                <input type="checkbox" aria-label={`Corregir ${i.word}`} checked={!!on[i.word]} onChange={(e) => setOn({ ...on, [i.word]: e.target.checked })} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-muted line-through decoration-muted/60">{i.word}</span>
                    <span className="text-muted">→</span>
                    {i.suggestions.length > 1 ? (
                      <select
                        aria-label={`Corrección de ${i.word}`}
                        value={pick[i.word]}
                        onChange={(e) => setPick({ ...pick, [i.word]: e.target.value })}
                        className="h-7 min-w-0 rounded-md border border-line bg-ink px-1.5"
                      >
                        {i.suggestions.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-semibold">{i.suggestions[0]}</span>
                    )}
                    {i.kind === "tilde" ? <SuggestDot /> : null}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {KIND_LABEL[i.kind]} · {i.count} {i.count === 1 ? "vez" : "veces"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <Button
            variant="primary"
            className="h-9 self-start"
            disabled={!marked.length}
            onClick={() => {
              onApply({ ...fixes, ...Object.fromEntries(marked.map((i) => [i.word, pick[i.word]])) });
              setIssues(issues.filter((i) => !marked.includes(i)));
            }}
          >
            Aplicar {marked.length || ""} {marked.length === 1 ? "corrección" : "correcciones"}
          </Button>
        </>
      ) : null}
      {applied.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">Aplicadas ({applied.length}):</span>
          <div className="flex flex-wrap gap-1.5">
            {applied.map(([w, r]) => (
              <span key={w} className="flex items-center gap-1 rounded-full border border-line py-0.5 pl-2.5 pr-1 text-xs">
                {w} → {r}
                <button
                  type="button"
                  aria-label={`Deshacer ${w}`}
                  title="Deshacer"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-panel-2 hover:text-text"
                  onClick={() => {
                    const next = { ...fixes };
                    delete next[w];
                    onApply(next);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
