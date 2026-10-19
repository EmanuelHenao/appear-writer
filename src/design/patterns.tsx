import { memo, type ReactElement } from "react";
import { z } from "zod";
import type { Palette } from "./palettes";

// Fondos generativos: patrones geométricos, funciones matemáticas, emojis y
// ASCII. Todo sale de una semilla, así que la vista previa, el PNG exportado
// y una plantilla guardada dibujan exactamente lo mismo. Sin IA ni red.

export const PATTERN_GROUPS = [
  { id: "geometrico", label: "Geométricos" },
  { id: "matematico", label: "Funciones matemáticas" },
  { id: "emoji", label: "Emojis" },
  { id: "ascii", label: "ASCII" },
] as const;

export type PatternGroup = (typeof PATTERN_GROUPS)[number]["id"];

export const PATTERNS = [
  { id: "truchet", group: "geometrico", label: "Truchet", hint: "Arcos que se enlazan" },
  { id: "bauhaus", group: "geometrico", label: "Bauhaus", hint: "Círculos, medios y bloques" },
  { id: "triangulos", group: "geometrico", label: "Triángulos", hint: "Rejilla en diagonal" },
  { id: "semitono", group: "geometrico", label: "Semitono", hint: "Puntos que crecen" },
  { id: "franjas", group: "geometrico", label: "Franjas", hint: "Bandas inclinadas" },
  { id: "confeti", group: "geometrico", label: "Confeti", hint: "Formas dispersas" },
  { id: "flujo", group: "matematico", label: "Campo de flujo", hint: "Líneas sobre ruido Perlin" },
  { id: "lissajous", group: "matematico", label: "Lissajous", hint: "Senos cruzados" },
  { id: "espirografo", group: "matematico", label: "Espirógrafo", hint: "Hipotrocoides" },
  { id: "rosa", group: "matematico", label: "Curva rosa", hint: "r = cos(kθ)" },
  { id: "ondas", group: "matematico", label: "Ondas", hint: "Senos apilados" },
  { id: "topografico", group: "matematico", label: "Curvas de nivel", hint: "Mapa topográfico" },
  { id: "voronoi", group: "matematico", label: "Voronoi", hint: "Celdas de vecindad" },
  { id: "arbol", group: "matematico", label: "Árbol fractal", hint: "Ramas recursivas" },
  { id: "emoji-rejilla", group: "emoji", label: "Rejilla de emojis", hint: "Ordenados y girados" },
  { id: "emoji-lluvia", group: "emoji", label: "Emojis dispersos", hint: "Tamaños al azar" },
  { id: "ascii-ruido", group: "ascii", label: "ASCII de ruido", hint: "Densidad de caracteres" },
  { id: "ascii-ondas", group: "ascii", label: "ASCII de ondas", hint: "Una función en texto" },
  { id: "ascii-codigo", group: "ascii", label: "Lluvia de código", hint: "Columnas de símbolos" },
] as const satisfies readonly { id: string; group: PatternGroup; label: string; hint: string }[];

export type PatternId = (typeof PATTERNS)[number]["id"];
export const PATTERN_IDS = PATTERNS.map((p) => p.id) as [PatternId, ...PatternId[]];
export const PatternIdEnum = z.enum(PATTERN_IDS);

export const INTENSITIES = [
  { id: "suave", label: "Suave" },
  { id: "media", label: "Media" },
  { id: "fuerte", label: "Fuerte" },
] as const;
export const IntensityEnum = z.enum(["suave", "media", "fuerte"]);
export type Intensity = z.infer<typeof IntensityEnum>;

export const DEFAULT_EMOJIS = "✨🌿🌙💛☀️";

/** Un patrón concreto: lo que se guarda en la propuesta y en las plantillas. */
export const PatternDesignSchema = z.object({
  seed: z.number().int(),
  layers: z.array(PatternIdEnum).min(1).max(3),
  intensity: IntensityEnum,
  scale: z.number().min(0.5).max(2),
  emojis: z.string().max(80),
});
export type PatternDesign = z.infer<typeof PatternDesignSchema>;

export function patternLabel(id: PatternId): string {
  return PATTERNS.find((p) => p.id === id)?.label ?? id;
}

// ── Azar con semilla ────────────────────────────────────────────────────

export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

const between = (r: Rng, a: number, b: number) => a + (b - a) * r();
const int = (r: Rng, a: number, b: number) => Math.floor(between(r, a, b + 1));
const pick = <T,>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];

/** Ruido Perlin 2D con semilla (valores aproximados en [-1, 1]). */
function makeNoise(r: Rng) {
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = [...perm, ...perm];
  const grad = (h: number, x: number, y: number) => {
    const g = h & 7;
    const u = g < 4 ? x : y;
    const v = g < 4 ? y : x;
    return (g & 1 ? -u : u) + (g & 2 ? -2 * v : 2 * v);
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + t * (b - a);
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];
    const n = lerp(lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u), lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u), v);
    return n / 2.2;
  };
}

/** Separa un texto en emojis (grafemas que no son letras ni números). */
export function splitEmojis(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  const parts = Seg ? Array.from(new Seg("es", { granularity: "grapheme" }).segment(text), (s) => s.segment) : Array.from(text);
  return parts.filter((g) => /\p{Extended_Pictographic}/u.test(g));
}

// ── Dibujo ──────────────────────────────────────────────────────────────

interface Ctx {
  w: number;
  h: number;
  r: Rng;
  /** Factor de escala: densidad elegida × tamaño de la diapositiva. */
  s: number;
  inks: string[];
  ink: () => string;
  emojis: string[];
  uid: string;
}

const f1 = (n: number) => Math.round(n * 10) / 10;

function poly(points: [number, number][], close = false): string {
  if (!points.length) return "";
  let d = `M${f1(points[0][0])} ${f1(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += `L${f1(points[i][0])} ${f1(points[i][1])}`;
  return close ? d + "Z" : d;
}

type Painter = (c: Ctx) => ReactElement;

const truchet: Painter = ({ w, h, r, s, ink }) => {
  const c = Math.round(between(r, 70, 120) * s);
  const q = c / 2;
  let d = "";
  for (let y = 0; y < h; y += c) {
    for (let x = 0; x < w; x += c) {
      if (r() < 0.5) {
        d += `M${x + q} ${y}A${q} ${q} 0 0 1 ${x} ${y + q}M${x + c} ${y + q}A${q} ${q} 0 0 0 ${x + q} ${y + c}`;
      } else {
        d += `M${x + q} ${y}A${q} ${q} 0 0 0 ${x + c} ${y + q}M${x} ${y + q}A${q} ${q} 0 0 1 ${x + q} ${y + c}`;
      }
    }
  }
  return <path d={d} fill="none" stroke={ink()} strokeWidth={f1(c * between(r, 0.1, 0.2))} strokeLinecap="round" />;
};

const bauhaus: Painter = ({ w, h, r, s, ink }) => {
  const cols = Math.max(3, Math.round(between(r, 4, 6) / s));
  const c = w / cols;
  const rows = Math.ceil(h / c);
  const out: ReactElement[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * c;
      const y = j * c;
      const k = r();
      const fill = ink();
      const rot = int(r, 0, 3) * 90;
      const t = `rotate(${rot} ${x + c / 2} ${y + c / 2})`;
      const key = `${i}-${j}`;
      if (k < 0.18) out.push(<circle key={key} cx={x + c / 2} cy={y + c / 2} r={c * 0.42} fill={fill} />);
      else if (k < 0.38) out.push(<path key={key} transform={t} d={`M${x} ${y + c}A${c / 2} ${c / 2} 0 0 1 ${x + c} ${y + c}Z`} fill={fill} />);
      else if (k < 0.58) out.push(<path key={key} transform={t} d={`M${x} ${y}L${x + c} ${y}A${c} ${c} 0 0 1 ${x} ${y + c}Z`} fill={fill} />);
      else if (k < 0.7) out.push(<path key={key} transform={t} d={`M${x} ${y + c}L${x + c} ${y + c}L${x} ${y}Z`} fill={fill} />);
      else if (k < 0.8) out.push(<rect key={key} x={x + c * 0.18} y={y + c * 0.18} width={c * 0.64} height={c * 0.64} fill={fill} />);
    }
  }
  return <g>{out}</g>;
};

const triangulos: Painter = ({ w, h, r, s, ink }) => {
  const c = Math.round(between(r, 90, 150) * s);
  const out: ReactElement[] = [];
  for (let y = 0; y < h; y += c) {
    for (let x = 0; x < w; x += c) {
      const flip = r() < 0.5;
      const a = flip ? `M${x} ${y}L${x + c} ${y}L${x} ${y + c}Z` : `M${x} ${y}L${x + c} ${y}L${x + c} ${y + c}Z`;
      const b = flip ? `M${x + c} ${y}L${x + c} ${y + c}L${x} ${y + c}Z` : `M${x} ${y}L${x + c} ${y + c}L${x} ${y + c}Z`;
      if (r() < 0.55) out.push(<path key={`a${x}-${y}`} d={a} fill={ink()} />);
      if (r() < 0.25) out.push(<path key={`b${x}-${y}`} d={b} fill={ink()} opacity={0.6} />);
    }
  }
  return <g>{out}</g>;
};

const semitono: Painter = ({ w, h, r, s, ink }) => {
  const c = Math.round(between(r, 26, 44) * s);
  const ang = r() * Math.PI * 2;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const span = Math.abs(dx) * w + Math.abs(dy) * h;
  const fill = ink();
  let d = "";
  for (let y = c / 2, row = 0; y < h + c; y += c * 0.866, row++) {
    for (let x = (row % 2) * (c / 2); x < w + c; x += c) {
      const t = ((x - w / 2) * dx + (y - h / 2) * dy) / span + 0.5;
      const rad = (c / 2) * Math.max(0, Math.min(1, t)) * 0.95;
      if (rad < 1) continue;
      d += `M${f1(x - rad)} ${f1(y)}a${f1(rad)} ${f1(rad)} 0 1 0 ${f1(rad * 2)} 0a${f1(rad)} ${f1(rad)} 0 1 0 ${f1(-rad * 2)} 0`;
    }
  }
  return <path d={d} fill={fill} />;
};

const franjas: Painter = ({ w, h, r, s, ink }) => {
  const ang = pick(r, [-35, -20, 20, 35, 45, -45, 90]);
  const diag = Math.hypot(w, h);
  const out: ReactElement[] = [];
  let x = -diag / 2;
  let i = 0;
  while (x < diag / 2) {
    const bw = between(r, 18, 90) * s;
    const gap = between(r, 18, 110) * s;
    out.push(<rect key={i++} x={w / 2 + x} y={h / 2 - diag / 2} width={bw} height={diag} fill={ink()} />);
    x += bw + gap;
  }
  return <g transform={`rotate(${ang} ${w / 2} ${h / 2})`}>{out}</g>;
};

const confeti: Painter = ({ w, h, r, s, ink }) => {
  const n = Math.round(between(r, 70, 120) / (s * s));
  const out: ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const z = between(r, 14, 34) * s;
    const rot = r() * 360;
    const fill = ink();
    const k = r();
    if (k < 0.35) out.push(<rect key={i} x={x} y={y} width={z * 1.8} height={z * 0.55} rx={z * 0.2} fill={fill} transform={`rotate(${f1(rot)} ${f1(x)} ${f1(y)})`} />);
    else if (k < 0.6) out.push(<circle key={i} cx={x} cy={y} r={z * 0.45} fill={fill} />);
    else if (k < 0.8) out.push(<path key={i} d={`M${f1(x)} ${f1(y)}l${f1(z)} ${f1(z * 0.2)}l${f1(-z * 0.4)} ${f1(z * 0.9)}Z`} fill={fill} transform={`rotate(${f1(rot)} ${f1(x)} ${f1(y)})`} />);
    else
      out.push(
        <path key={i} d={`M${f1(x)} ${f1(y)}q${f1(z * 0.5)} ${f1(-z * 0.6)} ${f1(z)} 0t${f1(z)} 0t${f1(z)} 0`} fill="none" stroke={fill} strokeWidth={f1(z * 0.28)} strokeLinecap="round" transform={`rotate(${f1(rot)} ${f1(x)} ${f1(y)})`} />,
      );
  }
  return <g>{out}</g>;
};

const flujo: Painter = ({ w, h, r, s, inks }) => {
  const noise = makeNoise(r);
  const freq = between(r, 0.0012, 0.0028) / s;
  const turns = between(r, 1.5, 3);
  const n = Math.round(between(r, 260, 420) / s);
  const step = 7 * s;
  const groups: string[] = inks.slice(0, 3).map(() => "");
  for (let i = 0; i < n; i++) {
    let x = r() * w;
    let y = r() * h;
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k < 60; k++) {
      const a = noise(x * freq, y * freq) * Math.PI * 2 * turns;
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) break;
      pts.push([x, y]);
    }
    if (pts.length > 4) groups[i % groups.length] += poly(pts);
  }
  return (
    <g fill="none" strokeLinecap="round" strokeWidth={f1(2.6 * s)}>
      {groups.map((d, i) => (
        <path key={i} d={d} stroke={inks[i % inks.length]} />
      ))}
    </g>
  );
};

const lissajous: Painter = ({ w, h, r, s, ink }) => {
  const pairs = [
    [1, 2],
    [3, 2],
    [3, 4],
    [5, 4],
    [5, 6],
    [2, 5],
    [3, 5],
    [4, 7],
  ];
  const [a, b] = pick(r, pairs);
  const delta = r() * Math.PI;
  const copies = int(r, 3, 6);
  const out: ReactElement[] = [];
  for (let c = 0; c < copies; c++) {
    const k = 1 - c * (0.6 / copies);
    const A = (w / 2) * 0.92 * k;
    const B = (h / 2) * 0.92 * k;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 1400; i++) {
      const t = (i / 1400) * Math.PI * 2;
      pts.push([w / 2 + A * Math.sin(a * t + delta), h / 2 + B * Math.sin(b * t)]);
    }
    out.push(<path key={c} d={poly(pts, true)} fill="none" stroke={ink()} strokeWidth={f1(3 * s)} />);
  }
  return <g>{out}</g>;
};

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const espirografo: Painter = ({ w, h, r, s, ink }) => {
  const R = int(r, 5, 11);
  let rr = int(r, 2, R - 1);
  if (gcd(R, rr) === rr) rr = Math.max(2, rr - 1);
  const d = between(r, 0.5, 1.2) * rr;
  const turns = rr / gcd(R, rr);
  const maxRad = R - rr + d;
  const k = (Math.min(w, h) / 2) * 0.95 / maxRad / Math.max(0.7, s * 0.9);
  const copies = int(r, 1, 3);
  const out: ReactElement[] = [];
  for (let c = 0; c < copies; c++) {
    const kk = k * (1 - c * 0.22);
    const pts: [number, number][] = [];
    const N = 2400;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2 * turns;
      const x = (R - rr) * Math.cos(t) + d * Math.cos(((R - rr) / rr) * t);
      const y = (R - rr) * Math.sin(t) - d * Math.sin(((R - rr) / rr) * t);
      pts.push([w / 2 + x * kk, h / 2 + y * kk]);
    }
    out.push(<path key={c} d={poly(pts, true)} fill="none" stroke={ink()} strokeWidth={f1(2.4 * s)} />);
  }
  return <g>{out}</g>;
};

const rosa: Painter = ({ w, h, r, s, ink }) => {
  const [n, dd] = pick(r, [
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [3, 2],
    [5, 2],
    [7, 3],
    [5, 4],
    [7, 2],
  ]);
  const k = n / dd;
  const periods = dd % 2 === 1 && n % 2 === 1 ? dd : 2 * dd;
  const R = (Math.min(w, h) / 2) * 0.9;
  const rings = int(r, 2, 5);
  const out: ReactElement[] = [];
  for (let c = 0; c < rings; c++) {
    const rad = R * (1 - c / (rings + 0.6));
    const pts: [number, number][] = [];
    const N = 1800;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * periods;
      const q = rad * Math.cos(k * t);
      pts.push([w / 2 + q * Math.cos(t), h / 2 + q * Math.sin(t)]);
    }
    out.push(<path key={c} d={poly(pts, true)} fill="none" stroke={ink()} strokeWidth={f1(3 * s)} />);
  }
  return <g>{out}</g>;
};

const ondas: Painter = ({ w, h, r, s, inks }) => {
  const noise = makeNoise(r);
  const gap = between(r, 26, 46) * s;
  const amp = between(r, 20, 70) * s;
  const freq = between(r, 0.004, 0.012) / s;
  const drift = between(r, 0.05, 0.3);
  const groups = inks.slice(0, 2).map(() => "");
  let i = 0;
  for (let y0 = -amp; y0 < h + amp; y0 += gap, i++) {
    const pts: [number, number][] = [];
    for (let x = 0; x <= w; x += 8) {
      pts.push([x, y0 + amp * Math.sin(x * freq + i * drift) + amp * 0.6 * noise(x * 0.004, i * 0.15)]);
    }
    groups[i % groups.length] += poly(pts);
  }
  return (
    <g fill="none" strokeWidth={f1(3 * s)} strokeLinecap="round">
      {groups.map((d, k) => (
        <path key={k} d={d} stroke={inks[k % inks.length]} />
      ))}
    </g>
  );
};

const topografico: Painter = ({ w, h, r, s, ink }) => {
  const noise = makeNoise(r);
  const freq = between(r, 0.0018, 0.0035) / s;
  const step = 14;
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  const v: number[] = new Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x = i * step * freq;
      const y = j * step * freq;
      v[j * cols + i] = noise(x, y) + 0.5 * noise(x * 2.1 + 7, y * 2.1 + 3);
    }
  const levels = int(r, 9, 14);
  let d = "";
  for (let l = 1; l < levels; l++) {
    const t = -0.9 + (1.8 * l) / levels;
    for (let j = 0; j < rows - 1; j++)
      for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i];
        const b = v[j * cols + i + 1];
        const c = v[(j + 1) * cols + i + 1];
        const e = v[(j + 1) * cols + i];
        const x = i * step;
        const y = j * step;
        const pts: [number, number][] = [];
        if (a < t !== b < t) pts.push([x + ((t - a) / (b - a)) * step, y]);
        if (b < t !== c < t) pts.push([x + step, y + ((t - b) / (c - b)) * step]);
        if (e < t !== c < t) pts.push([x + ((t - e) / (c - e)) * step, y + step]);
        if (a < t !== e < t) pts.push([x, y + ((t - a) / (e - a)) * step]);
        if (pts.length >= 2) d += `M${f1(pts[0][0])} ${f1(pts[0][1])}L${f1(pts[1][0])} ${f1(pts[1][1])}`;
        if (pts.length === 4) d += `M${f1(pts[2][0])} ${f1(pts[2][1])}L${f1(pts[3][0])} ${f1(pts[3][1])}`;
      }
  }
  return <path d={d} fill="none" stroke={ink()} strokeWidth={f1(2.4 * s)} strokeLinecap="round" />;
};

function clip(polygon: [number, number][], px: number, py: number, nx: number, ny: number): [number, number][] {
  // Conserva el semiplano (p - P)·n <= 0.
  const out: [number, number][] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const da = (a[0] - px) * nx + (a[1] - py) * ny;
    const db = (b[0] - px) * nx + (b[1] - py) * ny;
    if (da <= 0) out.push(a);
    if (da <= 0 !== db <= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

const voronoi: Painter = ({ w, h, r, s, ink }) => {
  const n = Math.round(between(r, 18, 34) / (s * s));
  const pts = Array.from({ length: n }, () => [r() * w, r() * h] as [number, number]);
  const line = ink();
  const out: ReactElement[] = [];
  pts.forEach(([x, y], i) => {
    let cell: [number, number][] = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
    for (let j = 0; j < n && cell.length; j++) {
      if (j === i) continue;
      const [qx, qy] = pts[j];
      cell = clip(cell, (x + qx) / 2, (y + qy) / 2, qx - x, qy - y);
    }
    const filled = r() < 0.45;
    out.push(<path key={i} d={poly(cell, true)} fill={filled ? ink() : "none"} fillOpacity={filled ? between(r, 0.35, 0.85) : 0} stroke={line} strokeWidth={f1(4 * s)} strokeLinejoin="round" />);
  });
  return <g>{out}</g>;
};

const arbol: Painter = ({ w, h, r, s, ink }) => {
  const spread = between(r, 0.32, 0.6);
  const shrink = between(r, 0.68, 0.76);
  const depth = 10;
  const stroke = ink();
  const segs: string[] = Array.from({ length: depth + 1 }, () => "");
  const grow = (x: number, y: number, ang: number, len: number, lvl: number) => {
    if (lvl > depth || len < 2) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    segs[lvl] += `M${f1(x)} ${f1(y)}L${f1(x2)} ${f1(y2)}`;
    const jitter = () => between(r, -0.18, 0.18);
    grow(x2, y2, ang - spread + jitter(), len * (shrink + jitter() * 0.3), lvl + 1);
    grow(x2, y2, ang + spread + jitter(), len * (shrink + jitter() * 0.3), lvl + 1);
  };
  const trunk = (h * 0.24) / Math.max(0.7, s);
  grow(w * between(r, 0.35, 0.65), h + 4, -Math.PI / 2, trunk, 0);
  return (
    <g fill="none" stroke={stroke} strokeLinecap="round">
      {segs.map((d, i) => (
        <path key={i} d={d} strokeWidth={f1(Math.max(1.2, (depth + 1 - i) * 2.2 * s))} />
      ))}
    </g>
  );
};

const EMOJI_FONT = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";

const emojiRejilla: Painter = ({ w, h, r, s, emojis }) => {
  const c = Math.round(between(r, 120, 170) * s);
  const size = c * between(r, 0.42, 0.58);
  const tilt = between(r, -25, 25);
  const out: ReactElement[] = [];
  let k = 0;
  for (let y = c / 2, row = 0; y < h + c; y += c, row++) {
    for (let x = (row % 2 ? c / 2 : 0) + c / 4; x < w + c; x += c) {
      out.push(
        <text key={k++} x={f1(x)} y={f1(y)} fontSize={f1(size)} textAnchor="middle" dominantBaseline="central" transform={`rotate(${f1(tilt + between(r, -8, 8))} ${f1(x)} ${f1(y)})`}>
          {emojis[(row + Math.floor(x / c)) % emojis.length]}
        </text>,
      );
    }
  }
  return <g style={{ fontFamily: EMOJI_FONT }}>{out}</g>;
};

const emojiLluvia: Painter = ({ w, h, r, s, emojis }) => {
  const c = Math.round(between(r, 150, 210) * s);
  const out: ReactElement[] = [];
  let k = 0;
  for (let y = 0; y < h; y += c)
    for (let x = 0; x < w; x += c) {
      if (r() < 0.2) continue;
      const px = x + r() * c;
      const py = y + r() * c;
      const size = between(r, 0.25, 0.75) * c;
      out.push(
        <text key={k++} x={f1(px)} y={f1(py)} fontSize={f1(size)} textAnchor="middle" dominantBaseline="central" transform={`rotate(${f1(between(r, -40, 40))} ${f1(px)} ${f1(py)})`}>
          {pick(r, emojis)}
        </text>,
      );
    }
  return <g style={{ fontFamily: EMOJI_FONT }}>{out}</g>;
};

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";

function asciiGrid({ w, h, s, ink }: Ctx, value: (col: number, row: number, cols: number, rows: number) => string, fs0 = 22): ReactElement {
  const fs = Math.round(fs0 * s);
  const cw = fs * 0.6;
  const lh = fs * 1.15;
  const cols = Math.ceil(w / cw) + 1;
  const rows = Math.ceil(h / lh) + 1;
  const fill = ink();
  const lines: ReactElement[] = [];
  for (let j = 0; j < rows; j++) {
    let line = "";
    for (let i = 0; i < cols; i++) line += value(i, j, cols, rows);
    lines.push(
      <text key={j} x={0} y={f1(j * lh + fs)} style={{ whiteSpace: "pre" }}>
        {line}
      </text>,
    );
  }
  return (
    <g fill={fill} fontSize={fs} style={{ fontFamily: MONO, fontWeight: 600 }}>
      {lines}
    </g>
  );
}

const RAMP = " .·:-=+*#%@";

const asciiRuido: Painter = (c) => {
  const noise = makeNoise(c.r);
  const f = between(c.r, 0.035, 0.08);
  return asciiGrid(c, (i, j) => {
    const v = (noise(i * f, j * f * 1.9) + 0.6 * noise(i * f * 2.3 + 11, j * f * 4)) * 0.75 + 0.5;
    return RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor(v * RAMP.length)))];
  });
};

const asciiOndas: Painter = (c) => {
  const a = between(c.r, 0.08, 0.22);
  const b = between(c.r, 0.1, 0.3);
  const ph = c.r() * 6;
  const chars = pick(c.r, [" .oO@", " ~≈≋", " -=≡", " ·•●", " /\\X"]);
  return asciiGrid(c, (i, j) => {
    const v = (Math.sin(i * a + Math.sin(j * b + ph) * 2) * Math.cos(j * b * 0.6 - i * a * 0.3) + 1) / 2;
    return chars[Math.min(chars.length - 1, Math.floor(v * chars.length))];
  });
};

const asciiCodigo: Painter = (c) => {
  const glyphs = pick(c.r, ["01", "{}[]()<>/=;:", "0123456789ABCDEF", "+-*/=<>%&|", "アイウエオカキクケコ"]);
  const fs = 22;
  const cw = fs * 0.6 * c.s;
  const cols = Math.ceil(c.w / cw) + 1;
  const runs = Array.from({ length: cols }, () => {
    const out: [number, number][] = [];
    let y = Math.floor(c.r() * -20);
    while (y < 140) {
      const len = int(c.r, 4, 22);
      out.push([y, y + len]);
      y += len + int(c.r, 3, 18);
    }
    return out;
  });
  return asciiGrid(
    c,
    (i, j) => {
      const on = runs[i]?.some(([a, b]) => j >= a && j < b);
      return on ? glyphs[Math.floor(c.r() * glyphs.length)] : " ";
    },
    fs,
  );
};

const PAINTERS: Record<PatternId, Painter> = {
  truchet,
  bauhaus,
  triangulos,
  semitono,
  franjas,
  confeti,
  flujo,
  lissajous,
  espirografo,
  rosa,
  ondas,
  topografico,
  voronoi,
  arbol,
  "emoji-rejilla": emojiRejilla,
  "emoji-lluvia": emojiLluvia,
  "ascii-ruido": asciiRuido,
  "ascii-ondas": asciiOndas,
  "ascii-codigo": asciiCodigo,
};

const OPACITY: Record<Intensity, number> = { suave: 0.2, media: 0.4, fuerte: 0.72 };

/** Colores de trazo: los de la paleta que no son el fondo. */
function inkColors(p: Palette): string[] {
  const list = [p.accent2, p.accent, p.bg2, p.muted, p.fg].map((c) => c.toUpperCase());
  const bg = p.bg.toUpperCase();
  const out = Array.from(new Set(list.filter((c) => c !== bg)));
  return out.length ? out : [p.fg];
}

export interface PatternLayerProps {
  pattern: PatternDesign;
  palette: Palette;
  width: number;
  height: number;
  /** Variación por diapositiva en los carruseles. */
  index?: number;
}

function PatternLayerImpl({ pattern, palette, width: w, height: h, index = 1 }: PatternLayerProps) {
  const base = OPACITY[pattern.intensity] ?? OPACITY.media;
  const inks = inkColors(palette);
  const emojis = splitEmojis(pattern.emojis);
  const s = pattern.scale * (w / 1080);
  return (
    <svg aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {pattern.layers.map((id, li) => {
        const r = makeRng(pattern.seed + li * 7919 + (index - 1) * 104729);
        const offset = Math.floor(r() * inks.length);
        let n = 0;
        const ink = () => inks[(offset + n++ + (r() < 0.35 ? 1 : 0)) % inks.length];
        const order = inks.map((_, i) => inks[(offset + i) % inks.length]);
        const ctx: Ctx = { w, h, r, s, inks: order, ink, emojis: emojis.length ? emojis : splitEmojis(DEFAULT_EMOJIS), uid: `${li}` };
        // Los caracteres ASCII son finos y piden más tinta; los emojis ya traen su color.
        const boost = id.startsWith("ascii") ? 1.6 : id.startsWith("emoji") ? 1.1 : 1;
        // Las capas de encima van más suaves para que no se coman a la primera.
        const opacity = Math.min(1, base * boost * (li === 0 ? 1 : 0.75));
        return (
          <g key={`${id}-${li}`} opacity={f1(opacity * 100) / 100}>
            {PAINTERS[id](ctx)}
          </g>
        );
      })}
    </svg>
  );
}

/** Capa de patrón memorizada: solo se recalcula si cambia el patrón, la paleta o el tamaño. */
export const PatternLayer = memo(
  PatternLayerImpl,
  (a, b) =>
    a.width === b.width &&
    a.height === b.height &&
    a.index === b.index &&
    a.palette === b.palette &&
    JSON.stringify(a.pattern) === JSON.stringify(b.pattern),
);

// ── Elección ────────────────────────────────────────────────────────────

export interface PatternOptions {
  kinds: PatternId[];
  combine: boolean;
  layers: number;
  intensity: Intensity;
  emojis: string;
}

/** Crea un patrón concreto con los tipos marcados: uno al azar o varios combinados. */
export function makePattern(o: PatternOptions, seed: number): PatternDesign {
  const r = makeRng(seed ^ 0x5bd1e995);
  const kinds = o.kinds.length ? o.kinds : (["truchet"] as PatternId[]);
  const count = o.combine ? Math.min(Math.max(2, o.layers), 3, kinds.length) : 1;
  const pool = [...kinds];
  const layers: PatternId[] = [];
  for (let i = 0; i < count; i++) {
    const k = Math.floor(r() * pool.length);
    layers.push(pool.splice(k, 1)[0]);
  }
  // Los emojis y el ASCII quedan encima de los trazos.
  layers.sort((a, b) => weight(a) - weight(b));
  return { seed, layers, intensity: o.intensity, scale: 1, emojis: o.emojis };
}

function weight(id: PatternId): number {
  return id.startsWith("emoji") ? 2 : id.startsWith("ascii") ? 1 : 0;
}
