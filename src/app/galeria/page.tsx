import type { Metadata } from "next";
import { GalleryPage } from "./Gallery";

export const metadata: Metadata = { title: "Galería · Appear Writer" };

export default function Page() {
  return <GalleryPage />;
}
