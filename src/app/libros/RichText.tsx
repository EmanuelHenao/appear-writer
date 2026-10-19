"use client";

import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, ClearFormat } from "@/components/icons";
import { applyStyle, normalizeRuns, rangeHas, RUN_COLORS, RUN_FONTS, RUN_SIZES, type Run, type RunStyle } from "@/book/edits";
import { FONTS, fontStack } from "@/design/fonts";

// Editor de texto con formato. El DOM se pinta siempre desde los tramos
// (`Run[]`) y se vuelve a leer al escribir: nunca se guarda HTML.

export const SIZE_EM: Record<(typeof RUN_SIZES)[number], number> = { s: 0.85, m: 1, l: 1.3, xl: 1.65 };
const SIZE_LABEL: Record<(typeof RUN_SIZES)[number], string> = { s: "Pequeña", m: "Normal", l: "Grande", xl: "Muy grande" };
const COLOR_LABEL: Record<(typeof RUN_COLORS)[number], string> = { ink: "Tinta", accent: "Acento", deep: "Profundo", muted: "Suave" };

export type Palette = Record<(typeof RUN_COLORS)[number], string>;
export type Align = "izquierda" | "centro" | "derecha";

function paint(el: HTMLElement, runs: Run[], palette: Palette) {
  el.replaceChildren(
    ...runs.map((r) => {
      const s = document.createElement("span");
      s.textContent = r.t;
      if (r.b) {
        s.dataset.b = "1";
        s.style.fontWeight = "700";
      }
      if (r.i) {
        s.dataset.i = "1";
        s.style.fontStyle = "italic";
      }
      if (r.u) {
        s.dataset.u = "1";
        s.style.textDecoration = "underline";
      }
      if (r.font) {
        s.dataset.font = r.font;
        s.style.fontFamily = fontStack(r.font);
      }
      if (r.size) {
        s.dataset.size = r.size;
        s.style.fontSize = `${SIZE_EM[r.size]}em`;
      }
      if (r.color) {
        s.dataset.color = r.color;
        s.style.color = palette[r.color];
      }
      return s;
    }),
  );
}

/** Lee los tramos del DOM: cada nodo de texto hereda el estilo de sus spans. */
function read(root: HTMLElement): Run[] {
  const out: Run[] = [];
  const walk = (node: Node, style: RunStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push({ t: node.textContent ?? "", ...style });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      out.push({ t: "\n", ...style });
      return;
    }
    const d = node.dataset;
    const next: RunStyle = { ...style };
    if (d.b) next.b = true;
    if (d.i) next.i = true;
    if (d.u) next.u = true;
    if (d.font) next.font = d.font as RunStyle["font"];
    if (d.size) next.size = d.size as RunStyle["size"];
    if (d.color) next.color = d.color as RunStyle["color"];
    const block = node !== root && /^(DIV|P)$/.test(node.tagName);
    if (block && out.length && !out[out.length - 1].t.endsWith("\n")) out.push({ t: "\n" });
    node.childNodes.forEach((c) => walk(c, next));
  };
  walk(root, {});
  return normalizeRuns(out);
}

function offsets(root: HTMLElement): [number, number] | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null;
  const pos = (node: Node, off: number) => {
    const pre = document.createRange();
    pre.selectNodeContents(root);
    pre.setEnd(node, off);
    return pre.toString().length;
  };
  return [pos(r.startContainer, r.startOffset), pos(r.endContainer, r.endOffset)];
}

function restore(root: HTMLElement, [a, b]: [number, number]) {
  const find = (n: number): [Node, number] => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let left = n;
    let last: Node | null = null;
    while (walker.nextNode()) {
      const t = walker.currentNode;
      const len = t.textContent?.length ?? 0;
      if (left <= len) return [t, left];
      left -= len;
      last = t;
    }
    return last ? [last, last.textContent?.length ?? 0] : [root, 0];
  };
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(...find(a));
  range.setEnd(...find(b));
  sel.removeAllRanges();
  sel.addRange(range);
}

export function RichText({
  runs,
  onChange,
  palette,
  baseFont,
  align,
  onAlign,
  placeholder,
  label,
}: {
  runs: Run[];
  onChange: (runs: Run[]) => void;
  palette: Palette;
  baseFont: string;
  align?: Align;
  onAlign?: (a: Align | undefined) => void;
  placeholder?: string;
  label: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const emitted = useRef<string>("");
  // Rango elegido, recordado al soltar el ratón o una tecla (los botones no roban la selección).
  const [range, setRange] = useState<[number, number]>([0, 0]);

  // Solo se repinta cuando los tramos cambian desde fuera (deshacer, otro mensaje).
  useEffect(() => {
    const json = JSON.stringify(runs);
    if (el.current && json !== emitted.current) {
      paint(el.current, runs, palette);
      emitted.current = json;
    }
  }, [runs, palette]);

  const emit = (next: Run[]) => {
    emitted.current = JSON.stringify(next);
    onChange(next);
  };

  function remember() {
    if (!el.current) return;
    const o = offsets(el.current);
    if (o && (o[0] !== range[0] || o[1] !== range[1])) setRange(o);
  }

  function style(patch: Partial<RunStyle>) {
    if (!el.current) return;
    const [a, b] = offsets(el.current) ?? range;
    const next = applyStyle(read(el.current), a, b, patch);
    paint(el.current, next, palette);
    emit(next);
    if (a !== b) restore(el.current, [a, b]);
  }

  const current = runs;
  const [a, b] = range;
  const has = (k: "b" | "i" | "u") => rangeHas(current, a, b, k);
  const toggle = (k: "b" | "i" | "u") => style({ [k]: has(k) ? undefined : true });
  // Valor común del rango (o vacío si se mezclan) para los selectores.
  const common = <K extends "font" | "size" | "color">(k: K): RunStyle[K] | "" => {
    let pos = 0;
    let v: RunStyle[K] | "" | null = null;
    const [s, e] = a === b ? [0, Infinity] : [a, b];
    for (const r of current) {
      const ra = pos;
      pos += r.t.length;
      if (pos <= s || ra >= e) continue;
      const rv = r[k] ?? "";
      if (v === null) v = rv;
      else if (v !== rv) return "";
    }
    return v ?? "";
  };

  const btn = "flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[13px] hover:bg-panel-2";
  const keep = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="flex flex-col gap-2">
      <div role="toolbar" aria-label="Formato" className="flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-panel p-1">
        <button type="button" onMouseDown={keep} onClick={() => toggle("b")} aria-pressed={has("b")} aria-label="Negrita" title="Negrita (Ctrl+B)" className={`${btn} font-bold ${has("b") ? "bg-accent-soft text-accent" : ""}`}>
          B
        </button>
        <button type="button" onMouseDown={keep} onClick={() => toggle("i")} aria-pressed={has("i")} aria-label="Cursiva" title="Cursiva (Ctrl+I)" className={`${btn} font-serif italic ${has("i") ? "bg-accent-soft text-accent" : ""}`}>
          I
        </button>
        <button type="button" onMouseDown={keep} onClick={() => toggle("u")} aria-pressed={has("u")} aria-label="Subrayado" title="Subrayado (Ctrl+U)" className={`${btn} underline ${has("u") ? "bg-accent-soft text-accent" : ""}`}>
          U
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <select
          aria-label="Tipo de letra"
          value={common("font")}
          onMouseDown={remember}
          onChange={(e) => style({ font: (e.target.value || undefined) as RunStyle["font"] })}
          className="h-8 rounded-md bg-transparent px-1 text-[13px] hover:bg-panel-2"
        >
          <option value="">Letra del libro</option>
          {RUN_FONTS.map((f) => (
            <option key={f} value={f}>
              {FONTS[f].label}
            </option>
          ))}
        </select>
        <select
          aria-label="Tamaño"
          value={common("size")}
          onMouseDown={remember}
          onChange={(e) => style({ size: (e.target.value || undefined) as RunStyle["size"] })}
          className="h-8 rounded-md bg-transparent px-1 text-[13px] hover:bg-panel-2"
        >
          <option value="">Tamaño</option>
          {RUN_SIZES.map((s) => (
            <option key={s} value={s === "m" ? "" : s}>
              {SIZE_LABEL[s]}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-0.5" role="group" aria-label="Color">
          {RUN_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={keep}
              onClick={() => style({ color: c === "ink" ? undefined : c })}
              aria-label={`Color ${COLOR_LABEL[c]}`}
              title={COLOR_LABEL[c]}
              aria-pressed={(common("color") || "ink") === c}
              className={`flex h-8 w-7 items-center justify-center rounded-md hover:bg-panel-2 ${(common("color") || "ink") === c ? "bg-panel-2" : ""}`}
            >
              <span className="h-3.5 w-3.5 rounded-full border border-white/25" style={{ background: palette[c] }} />
            </button>
          ))}
        </span>
        {onAlign ? (
          <>
            <span className="mx-1 h-5 w-px bg-line" />
            {(
              [
                ["izquierda", "Alinear a la izquierda", AlignLeft],
                ["centro", "Centrar", AlignCenter],
                ["derecha", "Alinear a la derecha", AlignRight],
              ] as const
            ).map(([id, l, Icon]) => (
              <button key={id} type="button" onMouseDown={keep} onClick={() => onAlign(align === id ? undefined : id)} aria-pressed={align === id} aria-label={l} title={l} className={`${btn} ${align === id ? "bg-accent-soft text-accent" : ""}`}>
                <Icon />
              </button>
            ))}
          </>
        ) : null}
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" onMouseDown={keep} onClick={() => style({ b: undefined, i: undefined, u: undefined, font: undefined, size: undefined, color: undefined })} aria-label="Quitar formato" title="Quitar formato" className={btn}>
          <ClearFormat />
        </button>
      </div>
      <div
        ref={el}
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => el.current && emit(read(el.current))}
        onKeyUp={remember}
        onMouseUp={remember}
        onFocus={remember}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            document.execCommand("insertText", false, "\n");
          }
          const k = e.key.toLowerCase();
          if ((e.ctrlKey || e.metaKey) && (k === "b" || k === "i" || k === "u")) {
            e.preventDefault();
            remember();
            toggle(k);
          }
        }}
        className="rich min-h-24 whitespace-pre-wrap break-words rounded-lg border border-line-strong bg-ink px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-accent"
        style={{ fontFamily: baseFont, textAlign: align === "centro" ? "center" : align === "derecha" ? "right" : "left" }}
      />
      <p className="text-[11.5px] text-muted">Selecciona una palabra o una frase para darle formato. Sin selección, se aplica a todo el texto.</p>
    </div>
  );
}
