import type { CSSProperties, ReactNode } from "react";
import { splitEmphasis } from "../fit";
import { PatternLayer } from "../patterns";
import type { SlideSpec } from "../spec";

export const SANS_DETAIL = "'Jost Variable', system-ui, sans-serif";
export const MONO_DETAIL = "'JetBrains Mono Variable', ui-monospace, monospace";

/** ¿El fondo es una imagen? Entonces el texto pasa a claro sobre velo oscuro. */
export function onImage(spec: SlideSpec): boolean {
  return (spec.background === "foto" || spec.background === "ia") && !!spec.photo?.url;
}

/** Margen seguro: en 9:16 la interfaz de Instagram tapa arriba y abajo. */
export function safeInset(spec: SlideSpec): { top: number; bottom: number } {
  return spec.height >= 1900 ? { top: 250, bottom: 300 } : { top: 0, bottom: 0 };
}

export function Grain({ id, opacity = 0.3, tint = [0.25, 0.18, 0.1], frequency = "0.85" }: {
  id: string;
  opacity?: number;
  tint?: [number, number, number];
  frequency?: string;
}) {
  const [r, g, b] = tint;
  return (
    <svg aria-hidden="true" width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency={frequency} numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix values={`0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${opacity} 0`} />
      </filter>
      <rect width="100%" height="100%" fill="#000000" filter={`url(#${id})`} />
    </svg>
  );
}

/**
 * Capa de fondo común. «estilo» deja que la plantilla pinte el suyo
 * (se devuelve el color base); el resto sustituye la base.
 */
export function Backdrop({ spec, styleLayer }: { spec: SlideSpec; styleLayer?: ReactNode }) {
  const p = spec.palette;
  const uid = `${spec.templateId}-${spec.index}`;
  const base: CSSProperties = { position: "absolute", inset: 0 };
  if (onImage(spec)) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spec.photo!.url} alt="" style={{ ...base, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ ...base, background: "linear-gradient(180deg, rgba(10,8,12,0.35) 0%, rgba(10,8,12,0.55) 60%, rgba(10,8,12,0.72) 100%)" }} />
      </>
    );
  }
  switch (spec.background) {
    case "plano":
      return <div style={{ ...base, background: p.bg }} />;
    case "degradado":
      return <div style={{ ...base, background: `linear-gradient(165deg, ${p.bg} 0%, ${p.bg2} 100%)` }} />;
    case "patron":
      return (
        <>
          <div style={{ ...base, background: p.bg }} />
          {spec.pattern ? <PatternLayer pattern={spec.pattern} palette={p} width={spec.width} height={spec.height} index={spec.index} /> : null}
        </>
      );
    case "textura":
      return (
        <>
          <div style={{ ...base, background: p.bg }} />
          <Grain id={`tx-${uid}`} opacity={0.32} />
        </>
      );
    default:
      return (
        <>
          <div style={{ ...base, background: p.bg }} />
          {styleLayer}
        </>
      );
  }
}

/** Caja que ajusta el tamaño de letra al espacio disponible. */
export function FitText({
  max,
  min = 28,
  style,
  boxStyle,
  children,
}: {
  max: number;
  min?: number;
  style?: CSSProperties;
  boxStyle?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      data-fit-box=""
      data-fit-max={max}
      data-fit-min={min}
      style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", position: "relative", ...boxStyle }}
    >
      <div data-fit-text="" style={{ width: "100%", fontSize: max, overflowWrap: "normal", wordBreak: "normal", hyphens: "manual", ...style }}>
        {children}
      </div>
    </div>
  );
}

/** Texto con las palabras destacadas envueltas en el estilo de la plantilla. */
export function Emph({ text, emphasis, emStyle }: { text: string; emphasis: string[]; emStyle: CSSProperties }) {
  return (
    <>
      {splitEmphasis(text, emphasis).map((s, i) =>
        s.em ? (
          <span key={i} style={emStyle}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

export function Handle({ spec, style }: { spec: SlideSpec; style?: CSSProperties }) {
  const { handle, logoUrl } = spec.brand;
  if (!handle && !logoUrl) return <span />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 14, ...style }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" style={{ height: 44, width: "auto", maxWidth: 160, objectFit: "contain" }} />
      ) : null}
      {handle ? <span>{handle}</span> : null}
    </span>
  );
}

export function Counter({ spec, style }: { spec: SlideSpec; style?: CSSProperties }) {
  if (spec.total <= 1) return <span />;
  return (
    <span style={style}>
      {spec.index} / {spec.total}
    </span>
  );
}
