"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Ancho actual de un elemento, para escalar vistas previas. Devuelve un ref
 * de función, así funciona también con elementos que aparecen más tarde.
 */
export function useWidth<T extends HTMLElement>(fallback = 400) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    observer.current = ro;
  }, []);
  return [ref, width] as const;
}
