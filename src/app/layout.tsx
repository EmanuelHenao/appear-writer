import type { Metadata } from "next";
import "./fonts";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";

export const metadata: Metadata = {
  title: "Appear Writer",
  description: "Convierte tus palabras en imágenes para redes y en libros.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AppHeader />
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
