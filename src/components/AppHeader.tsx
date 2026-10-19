"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/imagenes", label: "Imágenes" },
  { href: "/libros", label: "Libros" },
];

const SIDE = [
  { href: "/galeria", label: "Galería" },
  { href: "/ajustes", label: "Ajustes" },
];

export function AppHeader() {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/imagenes" className="font-display text-[22px] font-extrabold tracking-tight">
          appear<span className="text-accent">·</span>writer
        </Link>
        <nav aria-label="Secciones" className="flex gap-1 rounded-[10px] bg-panel p-1">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active(t.href) ? "page" : undefined}
              className={`rounded-[7px] px-4 py-2 text-sm transition-colors ${
                active(t.href) ? "bg-accent font-semibold text-accent-ink" : "text-muted hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Herramientas" className="flex gap-5 text-sm">
          {SIDE.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active(t.href) ? "page" : undefined}
              className={active(t.href) ? "text-text" : "text-muted hover:text-text"}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
