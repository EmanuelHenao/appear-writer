// Modelo común al que se convierte cualquier fuente del libro.

export type Block =
  | { type: "heading"; text: string; level: 1 | 2 }
  | { type: "paragraph"; text: string }
  | {
      type: "message";
      author: string;
      /** Fecha y hora local en formato ISO sin zona (2024-03-14T23:41:00). */
      date: string | null;
      text: string;
      /** Nombres de archivo de imagen dentro de la carpeta media del libro. */
      media: string[];
    }
  | { type: "image"; src: string; caption?: string };

export type SourceKind = "whatsapp" | "docx" | "pdf" | "txt" | "texto";

export interface Source {
  id: string;
  name: string;
  kind: SourceKind;
  blocks: Block[];
  meta: {
    participants?: string[];
    messages?: number;
    images?: number;
    pages?: number;
    firstDate?: string | null;
    lastDate?: string | null;
    skipped?: number;
  };
}

export const KIND_LABEL: Record<SourceKind, string> = {
  whatsapp: "WhatsApp",
  docx: "Word",
  pdf: "PDF",
  txt: "Texto",
  texto: "Texto pegado",
};

export function describeSource(s: Source): string {
  const m = s.meta;
  const parts: string[] = [KIND_LABEL[s.kind]];
  if (m.messages != null) parts.push(`${m.messages.toLocaleString("es")} mensajes`);
  if (m.images) parts.push(`${m.images} ${m.images === 1 ? "foto" : "fotos"}`);
  if (m.pages) parts.push(`${m.pages} páginas`);
  if (m.messages == null) {
    const paras = s.blocks.filter((b) => b.type === "paragraph").length;
    parts.push(`${paras.toLocaleString("es")} párrafos`);
  }
  return parts.join(" · ");
}
