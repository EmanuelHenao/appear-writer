"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Close } from "./icons";

/**
 * Hoja que sube desde abajo en pantallas pequeñas: la vista previa sigue
 * visible arriba mientras editas. El asa la agranda o la vuelve a su altura.
 */
export function BottomSheet({ label, onClose, anchorId, children }: { label: string; onClose: () => void; anchorId?: string; children: ReactNode }) {
  const [tall, setTall] = useState(false);
  // Sin agrandar, la hoja empieza justo debajo del elemento ancla (la vista previa).
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const el = anchorId ? document.getElementById(anchorId) : null;
    if (!el) return;
    const measure = () => {
      const bottom = el.getBoundingClientRect().bottom;
      setTop(Math.min(Math.max(bottom + 8, window.innerHeight * 0.3), window.innerHeight * 0.55));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [anchorId]);

  useEffect(() => {
    // Mientras está abierta, la página de detrás no se desplaza.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <section
      role="dialog"
      aria-label={label}
      style={!tall && top !== null ? { height: `calc(100dvh - ${top}px)` } : undefined}
      className={`fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl border-t border-line-strong bg-panel shadow-[0_-12px_40px_rgba(0,0,0,0.55)] transition-[height] duration-200 ${tall ? "h-[88dvh]" : "h-[50dvh]"}`}
    >
      <div className="flex flex-none items-center justify-between px-3 pt-1.5">
        <span className="w-9" />
        <button
          type="button"
          onClick={() => setTall(!tall)}
          aria-label={tall ? "Hacer la hoja más baja" : "Hacer la hoja más alta"}
          className="flex h-8 w-24 items-center justify-center"
        >
          <span className="h-1.5 w-12 rounded-full bg-line-strong" />
        </button>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-text">
          <Close />
        </button>
      </div>
      <div id="sheet-body" className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
        {children}
      </div>
    </section>
  );
}
