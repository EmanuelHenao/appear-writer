import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  serverExternalPackages: ["playwright", "playwright-core", "unpdf", "mammoth"],
};

export default nextConfig;
