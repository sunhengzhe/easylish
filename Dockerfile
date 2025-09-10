# syntax=docker/dockerfile:1.7

# --- Builder stage ---
FROM node:20-slim AS builder

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Enable corepack (pnpm)
RUN corepack enable && corepack prepare pnpm@10.12.4 --activate

# Install deps first (better cache)
COPY package.json pnpm-lock.yaml ./
# Include app package manifest so pnpm can resolve workspace properly
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --no-frozen-lockfile --ignore-scripts=false

# Copy source and build
COPY . .
# Build web app via workspace script
RUN pnpm build

# --- Runtime stage ---
FROM node:20-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    TRANSFORMERS_CACHE=/app/.cache/transformers \
    VECTOR_PROVIDER=xenova \
    MODEL_ID=Xenova/paraphrase-multilingual-MiniLM-L12-v2

WORKDIR /app

# Create cache directory for model files, install certs for HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/.cache/transformers

# Copy standalone server output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/data ./data

# Create a minimal mock sharp module for @xenova/transformers
# Since we only use text processing, we don't need actual sharp functionality
RUN mkdir -p node_modules/sharp && \
    echo '{"name":"sharp","version":"0.34.3","main":"index.js","type":"commonjs"}' > node_modules/sharp/package.json && \
    echo 'module.exports = { versions: { vips: "8.15.3" }, format: {}, resize: () => ({}), png: () => ({}), jpeg: () => ({}), webp: () => ({}), avif: () => ({}), toBuffer: () => Buffer.from([]), toFile: () => Promise.resolve() };' > node_modules/sharp/index.js

EXPOSE 8080

# Start Next.js standalone server
CMD ["node", "server.js"]
