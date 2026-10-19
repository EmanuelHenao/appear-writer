"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

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

/** Ancho y alto de un elemento (para encajar la vista previa en su hueco). */
export function useSize<T extends HTMLElement>(fallback = { width: 800, height: 600 }) {
  const [size, setSize] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    ro.observe(el);
    observer.current = ro;
  }, []);
  return [ref, size] as const;
}

/** ¿Se cumple la media query? (false en el servidor). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
