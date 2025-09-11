# syntax=docker/dockerfile:1.7

# --- Builder stage ---
FROM node:20-slim AS builder

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Enable corepack (pnpm)
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

# Install deps first (better cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Include app package manifest so pnpm can resolve workspace properly
COPY apps/web/package.json ./apps/web/package.json
# The repo's lockfile version may differ from the pinned pnpm.
# Use --force to regenerate a compatible lockfile within the image layer.
RUN pnpm install --force

# Copy only the web app sources to avoid bloating the context
COPY apps/web ./apps/web

# Build from the web app directory
WORKDIR /app/apps/web
RUN pnpm install --force
RUN pnpm build

# --- Runtime stage ---
FROM node:20-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# Create cache directory for model files, install certs for HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy standalone server output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "apps/web/server.js"]
