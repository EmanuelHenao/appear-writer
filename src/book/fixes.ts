// Correcciones de ortografía elegidas por el usuario: palabra → reemplazo.
// Se aplican al maquetar; el texto original de las fuentes no se toca.

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function matchCase(original: string, replacement: string): string {
  if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] !== original[0].toLowerCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

export function applyFixes(text: string, fixes: Record<string, string>): string {
  const words = Object.keys(fixes).filter((w) => fixes[w] && fixes[w] !== w);
  if (!words.length || !text) return text;
  const re = new RegExp(`(?<!\\p{L})(${words.sort((a, b) => b.length - a.length).map(esc).join("|")})(?!\\p{L})`, "giu");
  return text.replace(re, (m) => matchCase(m, fixes[m.toLowerCase()] ?? m));
}
