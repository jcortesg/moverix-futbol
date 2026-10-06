FROM node:20-alpine AS base
RUN npm install -g pnpm@9.0.0

# ─── Dependencias ────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ─── Build ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY packages ./packages
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm build

# ─── Deploy bundle (pnpm deploy resuelve todas las deps del monorepo) ─────────
FROM base AS pruned
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY packages ./packages
COPY apps/api/package.json ./apps/api/
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
RUN pnpm --filter @moverix/api deploy --prod /app/deploy

# ─── Runner ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=pruned /app/deploy ./
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/src/db/migrations ./dist/db/migrations

USER nestjs
EXPOSE 3001
ENV PORT=3001

CMD ["node", "dist/apps/api/src/main"]
