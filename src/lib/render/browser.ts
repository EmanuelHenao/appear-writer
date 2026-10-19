import "server-only";
import { readFile } from "node:fs/promises";
import type { Browser, BrowserContext, Page, Route } from "playwright";
import { dataPath, mimeFor } from "../storage";
import { fontFilePath } from "./fontcss";

// Un Chromium compartido para todos los renders. Cada render abre su propio
// contexto. Los documentos se sirven desde un origen ficticio para que las
// fuentes y los archivos locales carguen sin pasar por la red.

export const VIRTUAL_ORIGIN = "http://appear.local/";

let browserPromise: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright");
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({
    executablePath,
    args: ["--font-render-hinting=none", "--disable-dev-shm-usage"],
  });
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
}

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launch().catch((e) => {
      browserPromise = null;
      throw new Error(
        `No se pudo abrir Chromium para generar archivos. Instálalo con «pnpm exec playwright install chromium» o indica CHROMIUM_PATH. (${e instanceof Error ? e.message : e})`,
      );
    });
  }
  return browserPromise;
}

export interface VirtualDoc {
  html: string;
  width: number;
  height: number;
  scale: number;
}

/** Abre un documento en una pestaña nueva y devuelve la página lista. */
export async function openDoc(doc: VirtualDoc): Promise<{ page: Page; context: BrowserContext }> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: doc.width, height: doc.height },
    deviceScaleFactor: doc.scale,
  });
  await context.route(`${VIRTUAL_ORIGIN}**`, (route) => serveVirtual(route, doc.html));
  const page = await context.newPage();
  await page.goto(`${VIRTUAL_ORIGIN}doc`, { waitUntil: "load", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready.then(() => true));
  return { page, context };
}

async function serveVirtual(route: Route, html: string) {
  const url = new URL(route.request().url());
  const p = decodeURIComponent(url.pathname.slice(1));
  try {
    if (p === "doc") {
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    }
    if (p.startsWith("fonts/")) {
      const file = fontFilePath(p.slice(6));
      if (!file) return route.fulfill({ status: 404 });
      return route.fulfill({ status: 200, contentType: "font/woff2", body: await readFile(file) });
    }
    if (p.startsWith("data/")) {
      const file = dataPath(...p.slice(5).split("/"));
      return route.fulfill({ status: 200, contentType: mimeFor(file), body: await readFile(file) });
    }
  } catch {
    return route.fulfill({ status: 404 });
  }
  return route.fulfill({ status: 404 });
}

/** Pasa una URL de la app (/api/files/...) al origen virtual. */
export function toVirtual(url: string | undefined): string | undefined {
  if (!url) return url;
  const m = url.match(/^\/api\/files\/(.+)$/);
  return m ? `${VIRTUAL_ORIGIN}data/${m[1]}` : url;
}
