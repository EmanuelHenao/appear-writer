// Paletas de las imágenes. Cada rol tiene un significado fijo para que
// cualquier plantilla funcione con cualquier paleta:
//  bg      superficie principal
//  bg2     segunda superficie (final del degradado, segundo bloque)
//  fg      texto sobre bg
//  accent  relleno de los resaltados
//  onAccent texto sobre accent
//  accent2 detalle decorativo
//  muted   texto secundario sobre bg

export interface Palette {
  id: string;
  label: string;
  bg: string;
  bg2: string;
  fg: string;
  accent: string;
  onAccent: string;
  accent2: string;
  muted: string;
}

export const PALETTES: Palette[] = [
  {
    id: "energia",
    label: "Energía",
    bg: "#F5E03B",
    bg2: "#FFB703",
    fg: "#111111",
    accent: "#111111",
    onAccent: "#F5E03B",
    accent2: "#E8452C",
    muted: "#4A4410",
  },
  {
    id: "noir",
    label: "Noir",
    bg: "#111111",
    bg2: "#2A2A2A",
    fg: "#F7F4EE",
    accent: "#F5E03B",
    onAccent: "#111111",
    accent2: "#E8452C",
    muted: "#B9B4AA",
  },
  {
    id: "pop",
    label: "Pop",
    bg: "#2340FF",
    bg2: "#FF6B2C",
    fg: "#FFFFFF",
    accent: "#FFE14D",
    onAccent: "#2340FF",
    accent2: "#FFE14D",
    muted: "#1A1033",
  },
  {
    id: "atardecer",
    label: "Atardecer",
    bg: "#FF4E50",
    bg2: "#FFD36E",
    fg: "#2A0F12",
    accent: "#2A0F12",
    onAccent: "#FFD36E",
    accent2: "#FF8A3D",
    muted: "#5A1E22",
  },
  {
    id: "tierra",
    label: "Tierra",
    bg: "#EFE9DF",
    bg2: "#DCCFBC",
    fg: "#3B342C",
    accent: "#3B342C",
    onAccent: "#EFE9DF",
    accent2: "#B9A48A",
    muted: "#8A7B68",
  },
  {
    id: "salvia",
    label: "Salvia",
    bg: "#C9D3C0",
    bg2: "#A9B89E",
    fg: "#24302A",
    accent: "#24302A",
    onAccent: "#C9D3C0",
    accent2: "#7D9172",
    muted: "#4A5A50",
  },
  {
    id: "kraft",
    label: "Kraft",
    bg: "#E2D3B5",
    bg2: "#2F6F6A",
    fg: "#2A2320",
    accent: "#D96B4B",
    onAccent: "#FFF7EA",
    accent2: "#2F6F6A",
    muted: "#5E5040",
  },
  {
    id: "acuarela",
    label: "Acuarela",
    bg: "#F6F0E6",
    bg2: "#E9D8F0",
    fg: "#2B2433",
    accent: "#B4507E",
    onAccent: "#FFFFFF",
    accent2: "#7896D2",
    muted: "#6A5F70",
  },
  {
    id: "tinta",
    label: "Tinta",
    bg: "#16202E",
    bg2: "#2C3E57",
    fg: "#F3F4F6",
    accent: "#E8B25C",
    onAccent: "#16202E",
    accent2: "#8FA7C4",
    muted: "#A9B6C8",
  },
  {
    id: "vino",
    label: "Vino",
    bg: "#7A2E3A",
    bg2: "#4E1A24",
    fg: "#F2C9C0",
    accent: "#F2C9C0",
    onAccent: "#7A2E3A",
    accent2: "#E7A08F",
    muted: "#E3B1A6",
  },
];

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

/** Paleta de marca construida con tres colores del usuario. */
export function brandPalette(bg: string, fg: string, accent: string): Palette {
  return {
    id: "marca",
    label: "Marca",
    bg,
    bg2: mix(bg, accent, 0.35),
    fg,
    accent,
    onAccent: readableOn(accent),
    accent2: accent,
    muted: mix(fg, bg, 0.35),
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => ca[i] + (cb[i] - ca[i]) * t) as [number, number, number]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function readableOn(bg: string): string {
  return contrast(bg, "#111111") >= contrast(bg, "#FFFFFF") ? "#111111" : "#FFFFFF";
}
