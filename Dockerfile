# La imagen oficial de Playwright trae Chromium y sus dependencias del
# sistema; su versión debe coincidir con la del paquete «playwright».
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM base AS run
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
RUN mkdir -p /data && chown -R pwuser:pwuser /data /app/.next
USER pwuser
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/next", "start"]
