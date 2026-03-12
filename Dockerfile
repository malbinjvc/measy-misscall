# ── Build stage ──────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files + prisma schema (needed by postinstall)
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install dependencies (postinstall runs prisma generate)
RUN npm install --legacy-peer-deps

# Copy source and build
COPY . .

# NEXT_PUBLIC_ vars must be present at build time (inlined into client bundle)
ARG NEXT_PUBLIC_APP_URL=https://measy-misscall-153246875352.northamerica-northeast2.run.app
ARG NEXT_PUBLIC_APP_NAME="Measy MissCall"
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME

RUN npm run build

# ── Production stage ─────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# OpenSSL for Prisma engine compatibility
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma client needs the engine
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 8080

# Cloud Run sends SIGTERM for graceful shutdown
CMD ["node", "server.js"]
