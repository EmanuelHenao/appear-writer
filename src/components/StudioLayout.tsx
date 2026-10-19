"use client";

import type { ReactNode } from "react";
import { CheckMark } from "./icons";

export interface Step {
  /** id del elemento al que lleva el paso. */
  id: string;
  label: string;
  done?: boolean;
  current?: boolean;
}

/**
 * Estudio en dos columnas. A la izquierda, los pasos con scroll propio y la
 * acción principal fija al pie; a la derecha, la vista previa, que no se
 * mueve. En pantallas pequeñas las columnas se apilan.
 */
export function StudioLayout({
  steps,
  navExtra,
  aside,
  footer,
  stickyPreview = false,
  children,
}: {
  steps: Step[];
  /** En móvil, la vista previa va arriba y se queda fija al hacer scroll. */
  stickyPreview?: boolean;
  navExtra?: ReactNode;
  aside: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="grid w-full flex-1 lg:h-[calc(100dvh-65px)] lg:flex-none lg:grid-cols-[440px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
      <aside className="flex min-h-0 flex-col border-line bg-panel lg:border-r">
        <nav aria-label="Pasos" className="flex flex-none flex-wrap items-center gap-1 border-b border-line px-4 py-2.5">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.current ? "step" : undefined}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] ${s.current ? "bg-accent-soft text-text" : "text-muted hover:text-text"}`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[11px] ${
                  s.done && !s.current ? "border-ok bg-ok text-ink" : s.current ? "border-accent text-accent" : "border-line-strong"
                }`}
              >
                {s.done && !s.current ? <CheckMark /> : i + 1}
              </span>
              {s.label}
            </button>
          ))}
          {navExtra ? <div className="ml-auto text-xs">{navExtra}</div> : null}
        </nav>
        <div id="studio-aside" className="scroll-thin flex min-h-0 flex-1 flex-col gap-7 px-6 pb-6 pt-5 lg:overflow-y-auto">
          {aside}
        </div>
        <div className="sticky bottom-0 z-10 flex-none border-t border-line bg-panel px-6 py-3.5">{footer}</div>
      </aside>
      <section
        className={`flex min-h-0 min-w-0 flex-col gap-4 px-4 py-5 sm:px-8 ${
          stickyPreview ? "max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:order-first max-lg:gap-2.5 max-lg:border-b max-lg:border-line max-lg:bg-ink/95 max-lg:py-3 max-lg:backdrop-blur" : ""
        }`}
      >
        {children}
      </section>
    </main>
  );
}

/** Cabecera de un paso dentro de la columna izquierda. */
export function StepHead({ label, children, accent }: { label: string; children?: ReactNode; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="eyebrow" style={accent ? { color: "var(--color-accent)" } : undefined}>
        {label}
      </span>
      {children}
    </div>
  );
}
