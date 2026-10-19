import type { CSSProperties, ReactElement } from "react";
import { fontStack, type FontId } from "../fonts";
import { mix, readableOn } from "../palettes";
import type { FamilyId, SlideSpec } from "../spec";
import {
  Backdrop,
  Counter,
  Emph,
  FitText,
  Grain,
  Handle,
  MONO_DETAIL,
  SANS_DETAIL,
  onImage,
  safeInset,
} from "./parts";

export interface TemplateDef {
  id: string;
  family: FamilyId;
  label: string;
  defaultPalette: string;
  /** Paletas alternativas para «Crear otras 4». */
  altPalettes: string[];
  defaultFont: FontId;
  render: (spec: SlideSpec) => ReactElement;
}

const root = (spec: SlideSpec, extra?: CSSProperties): CSSProperties => ({
  width: spec.width,
  height: spec.height,
  position: "relative",
  overflow: "hidden",
  boxSizing: "border-box",
  ...extra,
});

const font = (spec: SlideSpec, def: FontId) => fontStack(spec.font ?? def);
const sz = (spec: SlideSpec, n: number) => Math.round(n * spec.sizeScale);

// 1 · Bold póster: letra gigante en mayúsculas, la frase destacada en bloque.
const boldPoster: TemplateDef = {
  id: "bold-poster",
  family: "bold",
  label: "Póster",
  defaultPalette: "energia",
  altPalettes: ["noir", "vino", "salvia"],
  defaultFont: "anton",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const fg = img ? "#FFFFFF" : p.fg;
    const inset = safeInset(spec);
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${80 + inset.top}px 72px ${64 + inset.bottom}px`,
            display: "flex",
            flexDirection: "column",
            gap: 40,
            color: fg,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO_DETAIL, fontSize: 24, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            <span>{spec.label ?? ""}</span>
            <Counter spec={spec} />
          </div>
          <FitText
            max={sz(spec, 230)}
            boxStyle={{ alignItems: "center" }}
            style={{ fontFamily: font(spec, "anton"), lineHeight: 0.9, textTransform: "uppercase", letterSpacing: "-0.01em" }}
          >
            <Emph
              text={spec.text}
              emphasis={spec.emphasis}
              emStyle={{
                display: "inline-block",
                background: p.accent,
                color: p.onAccent,
                padding: "0.04em 0.12em 0",
                lineHeight: 0.92,
                transform: "rotate(-2deg)",
                margin: "0.06em 0",
              }}
            />
          </FitText>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: MONO_DETAIL, fontSize: 26 }}>
            <Handle spec={spec} />
            <span style={{ width: 240, height: 12, background: p.accent2 }} />
          </div>
        </div>
      </div>
    );
  },
};

// 2 · Bold noir: condensada, fondo oscuro, resaltado tipo marcador.
const boldNoir: TemplateDef = {
  id: "bold-noir",
  family: "bold",
  label: "Noir",
  defaultPalette: "noir",
  altPalettes: ["tinta", "vino", "energia"],
  defaultFont: "bigshoulders",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const inset = safeInset(spec);
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${80 + inset.top}px 80px ${72 + inset.bottom}px`,
            display: "flex",
            flexDirection: "column",
            gap: 36,
            color: img ? "#FFFFFF" : p.fg,
          }}
        >
          <div style={{ fontFamily: font(spec, "bigshoulders"), fontWeight: 900, fontSize: 44, letterSpacing: "0.08em", textTransform: "uppercase", color: p.accent2, minHeight: 44 }}>
            {spec.label ?? ""}
          </div>
          <FitText
            max={sz(spec, 150)}
            boxStyle={{ alignItems: "flex-end" }}
            style={{ fontFamily: font(spec, "bigshoulders"), fontWeight: 800, lineHeight: 0.98, textTransform: "uppercase" }}
          >
            <Emph
              text={spec.text}
              emphasis={spec.emphasis}
              emStyle={{ display: "inline-block", background: p.accent, color: p.onAccent, padding: "0.04em 0.1em 0", lineHeight: 0.98, margin: "0.04em 0" }}
            />
          </FitText>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO_DETAIL, fontSize: 24, color: img ? "rgba(255,255,255,0.85)" : p.muted }}>
            <Handle spec={spec} />
            <Counter spec={spec} />
          </div>
        </div>
      </div>
    );
  },
};

// 3 · Color vivo en bloques: dos superficies planas y una pegatina.
const vivoBloques: TemplateDef = {
  id: "vivo-bloques",
  family: "vivo",
  label: "Bloques",
  defaultPalette: "pop",
  altPalettes: ["atardecer", "kraft", "vino"],
  defaultFont: "archivo",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const inset = safeInset(spec);
    const split = (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "48%", background: p.bg2 }} />
    );
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} styleLayer={split} />
        {!img ? (
          <div
            style={{
              position: "absolute",
              right: 68,
              top: 68 + inset.top,
              width: 208,
              height: 208,
              borderRadius: "50%",
              background: p.accent,
              color: p.onAccent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontFamily: font(spec, "archivo"),
              fontWeight: 900,
              fontStretch: "125%",
              fontSize: spec.label ? 30 : 64,
              lineHeight: 1.05,
              transform: "rotate(12deg)",
              padding: 24,
              boxSizing: "border-box",
              textTransform: "uppercase",
            }}
          >
            {spec.label || "✦"}
          </div>
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${80 + inset.top}px 72px ${68 + inset.bottom}px`,
            display: "flex",
            flexDirection: "column",
            gap: 40,
            color: img ? "#FFFFFF" : readableOn(p.bg) === "#FFFFFF" ? "#FFFFFF" : p.fg,
          }}
        >
          <div style={{ fontFamily: MONO_DETAIL, fontSize: 24, letterSpacing: "0.12em", textTransform: "uppercase", minHeight: 28 }}>
            <Counter spec={spec} />
          </div>
          <FitText
            max={sz(spec, 150)}
            boxStyle={{ alignItems: "center", paddingTop: img ? 0 : 190 }}
            style={{ fontFamily: font(spec, "archivo"), fontWeight: 900, fontStretch: "125%", lineHeight: 0.95, letterSpacing: "-0.02em", textTransform: "uppercase" }}
          >
            <Emph text={spec.text} emphasis={spec.emphasis} emStyle={{ color: p.accent }} />
          </FitText>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO_DETAIL, fontSize: 26, color: img ? "#FFFFFF" : readableOn(p.bg2) }}>
            <Handle spec={spec} />
          </div>
        </div>
      </div>
    );
  },
};

// 4 · Atardecer: degradado cálido con grano y letra oscura grande.
const vivoAtardecer: TemplateDef = {
  id: "vivo-atardecer",
  family: "vivo",
  label: "Atardecer",
  defaultPalette: "atardecer",
  altPalettes: ["pop", "acuarela", "salvia"],
  defaultFont: "bricolage",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const inset = safeInset(spec);
    const fg = img ? "#FFFFFF" : p.fg;
    const layer = (
      <>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(170deg, ${p.bg} 0%, ${p.accent2} 45%, ${p.bg2} 100%)` }} />
        <Grain id={`at-${spec.index}`} opacity={0.22} tint={[0.2, 0.05, 0.05]} frequency="0.9" />
      </>
    );
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} styleLayer={layer} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${88 + inset.top}px 80px ${80 + inset.bottom}px`,
            display: "flex",
            flexDirection: "column",
            gap: 40,
            color: fg,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO_DETAIL, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            <span>{spec.label ?? ""}</span>
            <Counter spec={spec} />
          </div>
          <FitText
            max={sz(spec, 150)}
            boxStyle={{ alignItems: "center" }}
            style={{ fontFamily: font(spec, "bricolage"), fontWeight: 800, lineHeight: 0.98, letterSpacing: "-0.03em" }}
          >
            <Emph text={spec.text} emphasis={spec.emphasis} emStyle={{ fontWeight: 500, fontStyle: "italic" }} />
          </FitText>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: MONO_DETAIL, fontSize: 26 }}>
            <Handle spec={spec} />
            <span style={{ width: 120, height: 120, borderRadius: "50%", border: `4px solid ${fg}` }} />
          </div>
        </div>
      </div>
    );
  },
};

// 5 · Minimal serif: tonos tierra, cursiva fina abajo a la izquierda.
const minimalSerif: TemplateDef = {
  id: "minimal-serif",
  family: "minimal",
  label: "Serif",
  defaultPalette: "tierra",
  altPalettes: ["salvia", "acuarela", "tinta"],
  defaultFont: "cormorant",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const inset = safeInset(spec);
    const fg = img ? "#FFFFFF" : p.fg;
    const muted = img ? "rgba(255,255,255,0.85)" : p.muted;
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${112 + inset.top}px 96px ${96 + inset.bottom}px`,
            display: "flex",
            flexDirection: "column",
            gap: 48,
            color: fg,
          }}
        >
          <div style={{ fontFamily: SANS_DETAIL, fontSize: 22, letterSpacing: "0.32em", textTransform: "uppercase", color: muted, minHeight: 26 }}>
            {spec.label ?? ""}
          </div>
          <FitText
            max={sz(spec, 124)}
            boxStyle={{ alignItems: "flex-end" }}
            style={{ fontFamily: font(spec, "cormorant"), fontStyle: "italic", fontWeight: 400, lineHeight: 1.12, textWrap: "balance" }}
          >
            <div style={{ width: 80, height: 2, background: fg, marginBottom: 56 }} />
            <Emph text={spec.text} emphasis={spec.emphasis} emStyle={{ fontStyle: "normal", fontWeight: 600 }} />
          </FitText>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: SANS_DETAIL, fontSize: 22, letterSpacing: "0.2em", textTransform: "uppercase", color: muted }}>
            <Handle spec={spec} />
            <Counter spec={spec} />
          </div>
        </div>
      </div>
    );
  },
};

// 6 · Minimal centrado: una sola idea en el centro, mucho aire.
const minimalCentro: TemplateDef = {
  id: "minimal-centro",
  family: "minimal",
  label: "Centrado",
  defaultPalette: "salvia",
  altPalettes: ["tierra", "noir", "vino"],
  defaultFont: "fraunces",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const inset = safeInset(spec);
    const fg = img ? "#FFFFFF" : p.fg;
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${96 + inset.top}px 96px ${96 + inset.bottom}px`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 48,
            color: fg,
            textAlign: "center",
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: fg, flex: "none" }} />
          <FitText
            max={sz(spec, 128)}
            boxStyle={{ alignItems: "center", width: "100%" }}
            style={{ fontFamily: font(spec, "fraunces"), fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.02em", textWrap: "balance" }}
          >
            <Emph text={spec.text} emphasis={spec.emphasis} emStyle={{ fontWeight: 500, fontStyle: "italic" }} />
          </FitText>
          <div style={{ fontFamily: SANS_DETAIL, fontSize: 22, letterSpacing: "0.3em", textTransform: "uppercase", color: img ? "rgba(255,255,255,0.85)" : p.muted, display: "flex", gap: 32 }}>
            <Handle spec={spec} />
            <Counter spec={spec} />
          </div>
        </div>
      </div>
    );
  },
};

// 7 · Collage: papel con grano, recortes girados y cinta adhesiva.
const arteCollage: TemplateDef = {
  id: "arte-collage",
  family: "arte",
  label: "Collage",
  defaultPalette: "kraft",
  altPalettes: ["acuarela", "tierra", "pop"],
  defaultFont: "dmserif",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const inset = safeInset(spec);
    const onBlock = readableOn(p.bg2) === "#FFFFFF" ? mix(p.bg, "#FFFFFF", 0.6) : p.fg;
    const tape = "rgba(250, 240, 210, 0.75)";
    const layer = <Grain id={`co-${spec.index}`} opacity={0.35} />;
    const em = spec.emphasis.length ? spec.emphasis.join(" ") : "";
    const main = em ? spec.text.replace(em, "").trim() || spec.text : spec.text;
    const h = spec.height - inset.top - inset.bottom;
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} styleLayer={layer} />
        <div
          style={{
            position: "absolute",
            left: 72,
            right: em ? 200 : 72,
            top: inset.top + h * 0.09,
            height: h * (em ? 0.5 : 0.72),
            background: img ? "rgba(20,16,12,0.55)" : p.bg2,
            transform: "rotate(-3deg)",
            boxShadow: "0 12px 28px rgba(40, 25, 10, 0.25)",
            padding: "56px 56px",
            boxSizing: "border-box",
            display: "flex",
          }}
        >
          <FitText
            max={sz(spec, 132)}
            boxStyle={{ alignItems: "center" }}
            style={{ fontFamily: font(spec, "dmserif"), lineHeight: 0.98, color: img ? "#FFFFFF" : onBlock }}
          >
            {main}
          </FitText>
        </div>
        {em ? (
          <div
            style={{
              position: "absolute",
              left: 260,
              right: 60,
              top: inset.top + h * 0.56,
              height: h * 0.3,
              background: p.accent,
              transform: "rotate(3deg)",
              boxShadow: "0 12px 28px rgba(40, 25, 10, 0.25)",
              padding: "32px 48px",
              boxSizing: "border-box",
              display: "flex",
            }}
          >
            <FitText
              max={sz(spec, 170)}
              boxStyle={{ alignItems: "center" }}
              style={{ fontFamily: "'Caveat Variable', cursive", fontWeight: 700, lineHeight: 0.9, color: p.onAccent }}
            >
              {em}
            </FitText>
          </div>
        ) : null}
        <div style={{ position: "absolute", left: 560, top: inset.top + h * 0.06, width: 240, height: 60, background: tape, transform: "rotate(18deg)" }} />
        <div style={{ position: "absolute", left: 220, top: inset.top + h * (em ? 0.82 : 0.78), width: 220, height: 60, background: tape, transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", left: 80, bottom: 64 + inset.bottom, right: 80, display: "flex", justifyContent: "space-between", fontFamily: "'Caveat Variable', cursive", fontWeight: 600, fontSize: 48, color: img ? "#FFFFFF" : p.fg }}>
          <Handle spec={spec} />
          <Counter spec={spec} />
        </div>
      </div>
    );
  },
};

// 8 · Acuarela: manchas difusas que continúan entre diapositivas.
const arteAcuarela: TemplateDef = {
  id: "arte-acuarela",
  family: "arte",
  label: "Acuarela",
  defaultPalette: "acuarela",
  altPalettes: ["tierra", "salvia", "atardecer"],
  defaultFont: "playfair",
  render: (spec) => {
    const p = spec.palette;
    const img = onImage(spec);
    const inset = safeInset(spec);
    const fg = img ? "#FFFFFF" : p.fg;
    // La mancha rosa sale por la derecha y entra por la izquierda de la siguiente.
    const shift = spec.index % 2 === 0;
    const blob = (style: CSSProperties, color: string): ReactElement => (
      <div style={{ position: "absolute", borderRadius: "48% 52% 40% 60%", background: `radial-gradient(circle at 45% 45%, ${color}, transparent 70%)`, filter: "blur(14px)", opacity: 0.8, ...style }} />
    );
    const layer = (
      <>
        {blob({ width: 840, height: 720, top: spec.height * 0.22, ...(shift ? { left: -540 } : { right: -300 }) }, p.accent)}
        {blob({ width: 640, height: 560, bottom: -160, ...(shift ? { right: -160 } : { left: -180 }) }, p.accent2)}
        {blob({ width: 720, height: 600, top: -200, ...(shift ? { left: -200 } : { right: -240 }) }, p.bg2)}
      </>
    );
    const last = spec.index === spec.total;
    return (
      <div style={root(spec)}>
        <Backdrop spec={spec} styleLayer={layer} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: `${96 + inset.top}px 96px ${88 + inset.bottom}px`,
            display: "flex",
            flexDirection: "column",
            gap: 40,
            color: fg,
          }}
        >
          <div style={{ fontFamily: SANS_DETAIL, fontSize: 26, letterSpacing: "0.2em", textTransform: "uppercase", minHeight: 30 }}>
            {spec.total > 1 ? `${spec.index} / ${spec.total}` : spec.label ?? ""}
          </div>
          <FitText
            max={sz(spec, 128)}
            boxStyle={{ alignItems: "center" }}
            style={{ fontFamily: font(spec, "playfair"), fontWeight: 600, lineHeight: 1.1 }}
          >
            <Emph text={spec.text} emphasis={spec.emphasis} emStyle={{ fontStyle: "italic", fontWeight: 500, color: img ? "#FFFFFF" : p.accent }} />
          </FitText>
          <div style={{ fontFamily: SANS_DETAIL, fontSize: 28, fontWeight: 500, display: "flex", justifyContent: "space-between" }}>
            {last ? <Handle spec={spec} /> : <span>Desliza →</span>}
          </div>
        </div>
      </div>
    );
  },
};

export const TEMPLATES: TemplateDef[] = [
  boldPoster,
  vivoBloques,
  minimalSerif,
  arteCollage,
  boldNoir,
  vivoAtardecer,
  minimalCentro,
  arteAcuarela,
];

export function getTemplate(id: string): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export function templatesOf(family: FamilyId): TemplateDef[] {
  return TEMPLATES.filter((t) => t.family === family);
}

export function Slide({ spec }: { spec: SlideSpec }) {
  return getTemplate(spec.templateId).render(spec);
}
