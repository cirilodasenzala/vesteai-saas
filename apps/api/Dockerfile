# =========================================================
# VesteAI API — imagem de produção (multi-stage)
# Build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t vesteai-api .
# =========================================================
FROM node:20-alpine AS base
WORKDIR /app
# Prisma no Alpine precisa do OpenSSL (libssl) para os engines.
RUN apk add --no-cache openssl

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci

# ---------- build ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace @vesteai/shared \
 && npx --workspace @vesteai/api prisma generate \
 && npm run build --workspace @vesteai/api

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
# Workspace @vesteai/shared é symlinkado em node_modules -> precisa do código real.
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/public ./apps/api/public
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
EXPOSE 3000
# Aplica migrações (schema explícito) e sobe a API. PORT vem do ambiente.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
