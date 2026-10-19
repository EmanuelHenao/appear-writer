import type { Metadata } from "next";
import { ImageStudio } from "./ImageStudio";

export const metadata: Metadata = { title: "Imágenes · Appear Writer" };

export default function Page() {
  return <ImageStudio />;
}
