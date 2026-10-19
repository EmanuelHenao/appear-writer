import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker: solo los archivos que la app usa (imagen mucho más pequeña).
  output: "standalone",
  // Las fuentes se leen de node_modules en tiempo de ejecución (render y vista previa del libro).
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/@fontsource*/*/*.css",
      "./node_modules/@fontsource*/*/files/*-latin-*.woff2",
      // Playwright carga sus módulos de forma dinámica y el rastreo no los ve.
      "./node_modules/.pnpm/playwright@*/node_modules/playwright/**/*",
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/**/*",
      // Diccionario de la revisión ortográfica sin IA.
      "./node_modules/dictionary-es/index.aff",
      "./node_modules/dictionary-es/index.dic",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // El indicador de desarrollo, abajo a la derecha: a la izquierda tapaba el botón principal del estudio.
  devIndicators: { position: "bottom-right" },
  // Playwright y unpdf cargan binarios y workers propios: se resuelven en Node.
  serverExternalPackages: ["playwright", "playwright-core", "unpdf", "mammoth", "nspell"],
};

export default nextConfig;
