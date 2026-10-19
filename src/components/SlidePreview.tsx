"use client";

import { useLayoutEffect, useRef } from "react";
import { autofitAll } from "@/design/autofit";
import type { SlideSpec } from "@/design/spec";
import { Slide } from "@/design/templates";

/**
 * Dibuja una diapositiva a su tamaño real (1080 px de ancho) y la escala
 * para que quepa en `width`. Es el mismo componente que exporta Chromium.
 */
export function SlidePreview({ spec, width, className = "" }: { spec: SlideSpec; width: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scale = width / spec.width;
  const key = JSON.stringify(spec);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    autofitAll(el);
    // Las fuentes pueden llegar después: se ajusta otra vez al cargarlas.
    document.fonts.ready.then(() => {
      if (!cancelled) autofitAll(el);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height: spec.height * scale }}>
      <div ref={ref} aria-hidden="true" style={{ width: spec.width, height: spec.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <Slide spec={spec} />
      </div>
      <span className="sr-only">{spec.text}</span>
    </div>
  );
}
