FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_BACKEND_URL_LIVE=/bims
ARG NEXT_PUBLIC_BASE_URL_LIVE=
ENV NEXT_PUBLIC_BACKEND_URL_LIVE=$NEXT_PUBLIC_BACKEND_URL_LIVE
ENV NEXT_PUBLIC_BASE_URL_LIVE=$NEXT_PUBLIC_BASE_URL_LIVE
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/next-env.d.ts ./next-env.d.ts
COPY --from=build /app/components.json ./components.json
COPY --from=build /app/postcss.config.mjs ./postcss.config.mjs
EXPOSE 3000
CMD ["npm", "run", "start"]