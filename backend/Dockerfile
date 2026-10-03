# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=5001 \
    TZ=Asia/Manila \
    DOCX_PDF_CONVERTER=libreoffice \
    SOFFICE_PATH=/usr/bin/soffice \
    TEMPLATE_DOCS_DIR=/app/templates/docs \
    TEMPLATE_ASSETS_DIR=/app/templates/public
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       libreoffice-writer-nogui \
       fonts-liberation2 fonts-dejavu-core fonts-crosextra-carlito fonts-crosextra-caladea \
       tzdata \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chown=node:node frontend/docs ./templates/docs
COPY --chown=node:node frontend/public/assets/docx-templates ./templates/public/assets/docx-templates
RUN mkdir -p /app/uploads /app/backups && chown node:node /app/uploads /app/backups
USER node
EXPOSE 5001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
