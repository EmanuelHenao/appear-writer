# Imagen mínima: Node + el Chromium «headless shell» de Playwright con sus
# dependencias del sistema, y la salida «standalone» de Next (solo los
# archivos que la app usa). La versión de Playwright debe coincidir con la
# del paquete «playwright» de package.json.
ARG PLAYWRIGHT_VERSION=1.63.0

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/

FROM node:24-bookworm-slim AS run
ARG PLAYWRIGHT_VERSION
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DATA_DIR=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Solo Chromium (sin Firefox ni WebKit) y las fuentes que necesita, incluidos los emojis.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps --only-shell chromium \
    && rm -rf /root/.npm /root/.cache /var/lib/apt/lists/* /tmp/*
WORKDIR /app
RUN groupadd -r app && useradd -r -g app -d /app app && mkdir -p /data && chown app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
USER app
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
