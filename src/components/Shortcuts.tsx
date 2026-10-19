"use client";

import { useEffect, useRef, useState } from "react";
import { Close } from "./icons";

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

/**
 * Atajos y controles del estudio, a mano sin perder lo que estás haciendo:
 * se abre encima con «?» o con el botón y se cierra con Esc, sin tocar el trabajo.
 */
export function Shortcuts({ groups }: { groups: ShortcutGroup[] }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !isTyping(e.target) && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.show();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} title="Atajos y controles (?)" className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-panel-2 hover:text-text">
        <kbd className="rounded border border-line-strong px-1 font-mono text-[10px]">?</kbd>
        Atajos
      </button>
      <dialog
        ref={dialog}
        aria-label="Atajos y controles"
        onClose={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className="fixed bottom-4 right-4 left-auto top-auto z-50 m-0 w-[min(380px,calc(100vw-32px))] rounded-2xl border border-line-strong bg-panel-2 p-0 text-text shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="font-display text-base font-bold">Atajos y controles</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-panel hover:text-text">
            <Close />
          </button>
        </div>
        <div className="scroll-thin flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-4 py-3">
          {groups.map((g) => (
            <section key={g.title} className="flex flex-col gap-1.5">
              <h3 className="eyebrow">{g.title}</h3>
              <dl className="flex flex-col gap-1">
                {g.items.map((it) => (
                  <div key={it.label} className="flex items-center justify-between gap-3 text-[13px]">
                    <dt className="text-muted">{it.label}</dt>
                    <dd className="flex flex-none gap-1">
                      {it.keys.map((k) => (
                        <kbd key={k} className="min-w-6 rounded border border-line-strong bg-ink px-1.5 py-0.5 text-center font-mono text-[11px]">
                          {k}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <p className="text-xs text-muted">Se abre y se cierra con ? sin perder lo que estás editando. Los atajos de una letra no actúan mientras escribes.</p>
        </div>
      </dialog>
    </>
  );
}
