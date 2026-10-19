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
  // Playwright y unpdf cargan binarios y workers propios: se resuelven en Node.
  serverExternalPackages: ["playwright", "playwright-core", "unpdf", "mammoth"],
};

export default nextConfig;
